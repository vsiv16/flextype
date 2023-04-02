from transformers import AutoTokenizer, AutoModelForTokenClassification

# SETUP: load label list from file, model, tokenizer from HuggingFace
types_file = open("/app/vocab_50k.txt", "r", encoding="utf-8")
label_list = types_file.read().splitlines()
model = AutoModelForTokenClassification.from_pretrained('kevinjesse/graphcodebert-MT4TS', num_labels=len(label_list))
tokenizer = AutoTokenizer.from_pretrained('microsoft/graphcodebert-base', fast=True, add_prefix_space=True )
