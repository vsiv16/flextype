from flask import Flask, request
import json
from transformers import AutoTokenizer, AutoModelForTokenClassification
from datasets import load_dataset
import torch

# create flask app
app = Flask(__name__)

# SETUP: load dataset, model, tokenizer from HuggingFace
dataset = load_dataset("kevinjesse/ManyTypes4TypeScript") # this should be removed
label_list = dataset["train"].features[f"labels"].feature.names # this should be replaced
model = AutoModelForTokenClassification.from_pretrained('kevinjesse/codebert-MT4TS', num_labels=len(label_list))
tokenizer = AutoTokenizer.from_pretrained('microsoft/codebert-base', fast=True, add_prefix_space=True )
# give type suggestions for a single 'word' contained in a snippet of code
@app.route('/suggest-types')
def suggest_types_single_token():

    input_string = request.args.get('input_string') ## this is now a list -- kevin
    input_list  = json.loads(input_string) #list or string can be passed, string avoids json decoding errors


    curr_word_index = int(request.args.get('word_index')) # index of the first char of the word in input str to suggest types for
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
    # data['token'] = tokens[curr_token_index]  # optional, can remove later

    # get label indices of top N type suggestions for current token
    type_label_indices = torch.argsort(outputs.logits[0,curr_token_index,:], dim=-1).flatten().detach().cpu().numpy()[::-1][:N].astype(int)
    # get top N type suggestion labels
    type_suggestions = []
    for t in range(N):
        type_suggestions.append(label_list[type_label_indices[t]])
    probabilities = (softmax(outputs.logits[0,curr_token_index,:]).flatten().detach().cpu().numpy()[type_label_indices]).tolist()

    #filter out any or unk.
    type_suggestions, probabilities = zip(*sorted(list(filter(lambda a: (a[0] != 'any' and a[0] != 'UNK'), zip(type_suggestions,probabilities)))[:N-2], key = lambda x: x[1], reverse=True))
    data['type_suggestions'] = type_suggestions

    # retrieve associated type suggestion probabilities for current input token
    data['probabilities'] = probabilities

    json_string = json.dumps(data, indent=4)
    print(json_string)
    return json_string

# give type suggestions for *all tokens* contained in a snippet of code
@app.route('/suggest-types-all') #, methods=["POST"])
def suggest_types_all_tokens():

    input_string = request.args.get('input-string')
    # current_word = request.args.get('word') # word to get type suggestion for

    # tokenize input
    tokenized_inputs = tokenizer(input_string, add_special_tokens=False, return_tensors="pt")
    # print("Tokenized Input: ", tokenized_inputs)

    outputs = model(**tokenized_inputs)

    softmax = torch.nn.Softmax(dim=-1)

    N = 5 # retrieve top N type suggestions
    NUM_WORDS = len(tokenized_inputs.encodings[0].word_ids) # number of words/tokens in input code
    tokens = tokenizer.convert_ids_to_tokens(tokenized_inputs['input_ids'][0].detach().cpu().numpy())

    all_suggestions = {}
    for i in range(NUM_WORDS):
        data = {} # single type suggestion
        
        data['token'] = tokens[i]
        data['input_word_number'] = tokenized_inputs.encodings[0].word_ids[i]
        
        # get label indices of top N type suggestions for current word
        type_label_indices = torch.argsort(outputs.logits[0,i,:], dim=-1).detach().cpu().numpy()[::-1][:5]
        
        type_suggestions = []
        for t in range(N):
            type_suggestions.append(label_list[type_label_indices[t]])
        # print(type_suggestions)
        data['type_suggestions'] = type_suggestions
        
        # retrieve associated type suggestion probabilities for current input token
        data['probabilities'] = (softmax(outputs.logits[0,i,:]).detach().cpu().numpy()[type_label_indices]).tolist()
        
        json_string = json.dumps(data, indent=4)
        # return json_string
        all_suggestions[i] = json_string
        # print(json.dumps(all_suggestions))
        # print(my_json_string)
    
    # return "hello"
    return json.dumps(all_suggestions)

# if __name__ == '__main__':
#     app.run(threaded=False)