from flask import Flask, request
from transformers import AutoTokenizer, AutoModelForTokenClassification
import torch
import json

from load_model import label_list, model, tokenizer

# create flask app
app = Flask(__name__)

print("FlexType: Starting Type Suggestion Server...")

# SETUP: load label list from file, model, tokenizer from HuggingFace
# types_file = open("/app/vocab_50k.txt", "r", encoding="utf-8")
# label_list = types_file.read().splitlines()
# model = AutoModelForTokenClassification.from_pretrained('kevinjesse/graphcodebert-MT4TS', num_labels=len(label_list))
# tokenizer = AutoTokenizer.from_pretrained('microsoft/graphcodebert-base', fast=True, add_prefix_space=True )

@app.route('/health')
def health():
    return "hello!"

# give type suggestions for a single 'word' contained in a snippet of code
@app.route('/suggest-types', methods=['POST'])
def suggest_types_single_token():
    data_json = request.json
    # input_string = request.args.get('input_string') ## this is now a list -- kevin
    # input_list  = json.loads(input_string) #list or string can be passed, string avoids json decoding errors
    # curr_word_index = int(request.args.get('word_index')) # index of first char of word of interest
    
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
    word_index = sub_id-start #should be in the middle..
    sublist = tokenized_inputs['input_ids'][0][start:end][:512]

    curr_token_index = word_index
    #curr_token_index = tokenized_inputs.encodings[0].char_to_token(word_index)

    #### get model outputs
    outputs = model(input_ids=torch.unsqueeze(sublist,0))
    softmax = torch.nn.Softmax(dim=-1)
    # return json.dumps(sublist.numpy().tolist())
    
    #### get type suggestions
    N = 7 # num of top type suggestions to retrieve
    tokens = tokenizer.convert_ids_to_tokens(tokenized_inputs['input_ids'][0].detach().cpu().numpy())
    data = {}

    # get label indices of top N type suggestions for current token
    type_label_indices = torch.argsort(outputs.logits[0,curr_token_index,:], dim=-1).flatten().detach().cpu().numpy()[::-1][:N].astype(int)
    # get top N type suggestion labels
    type_suggestions = []
    for t in range(N):
        type_suggestions.append(label_list[type_label_indices[t]])
    probabilities = (softmax(outputs.logits[0,curr_token_index,:]).flatten().detach().cpu().numpy()[type_label_indices]).tolist()

    #filter out any or unk.  # todo: add probability filter - 0.0001, check rounding
    type_suggestions, probabilities = zip(*sorted(list(filter(lambda a: (a[0] != 'any' and a[0] != 'UNK'), zip(type_suggestions,probabilities)))[:N-2], key = lambda x: x[1], reverse=True))
    data['type_suggestions'] = type_suggestions

    # retrieve associated type suggestion probabilities for current input token
    data['probabilities'] = probabilities

    json_string = json.dumps(data, indent=4)
    print(json_string)
    return json_string