from flask import Flask, request
from transformers import AutoTokenizer
import torch
import json
import onnxruntime
import numpy as np
# create flask app
app = Flask(__name__)
types_file = open("vocab_50k.txt", "r")
label_list = types_file.read().splitlines()
print("FlexType: Starting Type Suggestion Server...")
sess_options = onnxruntime.SessionOptions()
model_path = 'graphcodebert-MT4TS-optimized-quantized.onnx'
sess_options.graph_optimization_level = onnxruntime.GraphOptimizationLevel.ORT_ENABLE_ALL
session = onnxruntime.InferenceSession(model_path, sess_options)
tokenizer = AutoTokenizer.from_pretrained('microsoft/graphcodebert-base', fast=True, add_prefix_space=True )
softmax = torch.nn.Softmax(dim=-1)
# give type suggestions for a single 'word' contained in a snippet of code
@app.route('/suggest-types', methods=['POST'])
def suggest_types_single_token():
    data_json = request.json    
    input_string = data_json['input_string'] ## this is now a list -- kevin
    if isinstance(input_string, str):
        input_list  = json.loads(input_string) #list or string can be passed, string avoids json decoding errors
    else:
        input_list = input_string

    #sometimes this is an error. very odd.
    curr_word_index = int(data_json['word_index']) # index of first char of word of interest

    ##### tokenize input
    tokenized_inputs = tokenizer(input_list, add_special_tokens=False, return_tensors="pt", is_split_into_words=True)

    sub_id = None
    for e, wordid in enumerate(tokenized_inputs.encodings[0].word_ids):
        if wordid==curr_word_index:
            sub_id = e
            break

        #get window...
    start = max(0,sub_id-255)
    end = min(sub_id+255,len(tokenized_inputs['input_ids'][0]))
    word_index = sub_id-start+1 #should be in the middle.. we add one because of the [0] below
    sublist = torch.cat((torch.tensor([0]),tokenized_inputs['input_ids'][0][start:end][:510],torch.tensor([2])),0)
    curr_token_index = word_index
    t = torch.unsqueeze(sublist,0).numpy()
    ort_inputs = {
                        'input_ids': t.astype(int),
                        'attention_mask': np.ones(t.shape).astype(int)
                    }
    logits = session.run(None, ort_inputs)
    logits = logits[0][0][curr_token_index]
    logits_of_interest = torch.tensor(logits)
    #### get type suggestions
    N = 7 # num of top type suggestions to retrieve
    data = {}
    
    # get label indices of top N type suggestions for current token
    type_label_indices = torch.argsort(logits_of_interest, dim=-1).flatten().numpy()[::-1][:N].astype(int)
    # get top N type suggestion labels
    type_suggestions = []
    for t in range(N):
        type_suggestions.append(label_list[type_label_indices[t]])
    probabilities = (softmax(logits_of_interest).flatten().numpy()[type_label_indices]).tolist()

    #filter out any or unk.  # todo: add probability filter - 0.0001, check rounding
    type_suggestions, probabilities = zip(*sorted(list(filter(lambda a: (a[0] != 'any' and a[0] != 'UNK'), zip(type_suggestions,probabilities)))[:N-2], key = lambda x: x[1], reverse=True))
    data['type_suggestions'] = type_suggestions
    # retrieve associated type suggestion probabilities for current input token
    data['probabilities'] = probabilities
    json_string = json.dumps(data, indent=4)
    return json_string