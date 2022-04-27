import * as vscode from 'vscode';


var wordEnd: any;
var editorDocument: vscode.TextDocument;
var typeSuggestions = ["Type1", "Type2", "Type3", "Type4", "Type5"]; // init placeholders, updated w actual type suggestions below

async function getTypeSuggestions() {

	// hello message
	vscode.window.showInformationMessage("Hello from TypeScript Suggestions!");

	// verify that file is open in editor, get associated TextDocument
	const editor = vscode.window.activeTextEditor;
	if(editor === undefined) {
		vscode.window.showErrorMessage("Cannot suggest types without an open file.");
		return;
	}
	editorDocument = editor.document;

	// create hover
	vscode.languages.registerHoverProvider('javascript', {      // (?) "Type annotations can only be used in TypeScript files."
		provideHover: async (document, position) => {
			
			// get word at current cursor position
			const word = document.getText(document.getWordRangeAtPosition(position));
			wordEnd = document.getWordRangeAtPosition(position)?.end
			console.log('** Curr position: \n', position);
			console.log('** Curr word: \n', word);
			console.log('** Word end pos: \n', wordEnd);

			// send http request, receive type suggestions from model server

			var in_str = editorDocument.lineAt(position).text; // passing in current line as input for now
			var word_in: string = position.character.toString();
			
			// hardcoded input example
			// var in_str: string = `request('http://www.google.com', function (error, response, body) {
			// console.error('error:', error); // Print the error if one occurred
			// console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
			// console.log('body:', body); // Print the HTML for the Google homepage.
			// });`;
			// var word_in: string = "60";
			
			var params = {input_string:in_str, word_index: word_in}

			const fetch = require('node-fetch');
			const response = await fetch('http://127.0.0.1:5000/suggest-types?' 
				+ new URLSearchParams(params).toString());
			const data = await response.json();
			console.log(data);

			typeSuggestions = data.type_suggestions;
			console.log(typeSuggestions);

			// build hover MarkdownString with all five type suggestions   // TODO: add probabilities?
			const markdownTypes = new vscode.MarkdownString();
			markdownTypes.appendMarkdown('***Suggested Types:***\n\n');
			markdownTypes.appendMarkdown('**'+typeSuggestions[0]+'** *........................press \`Shift\`+\`1\` to accept*\n\n');
			markdownTypes.appendMarkdown('**'+typeSuggestions[1]+'** *........................press \`Shift\`+\`2\` to accept*\n\n');
			markdownTypes.appendMarkdown('**'+typeSuggestions[2]+'** *........................press \`Shift\`+\`3\` to accept*\n\n');
			markdownTypes.appendMarkdown('**'+typeSuggestions[3]+'** *........................press \`Shift\`+\`4\` to accept*\n\n');
			markdownTypes.appendMarkdown('**'+typeSuggestions[4]+'** *........................press \`Shift\`+\`5\` to accept*\n\n');

			// display type suggestions and acceptance keystrokes in hover
			return new vscode.Hover(markdownTypes);
		}
	});
}

function insertType(typeNum:number) {
	console.log("** Inserting type #", typeNum);
	console.log("** Type:", typeSuggestions[typeNum-1]);

	vscode.window.showTextDocument(editorDocument).then((editor) => {
		editor.edit(editBuilder => {
			// insert chosen type right after current word
			editBuilder.insert(wordEnd, ": "+typeSuggestions[typeNum-1]);
		}).then((applied) => {
			if(!applied) {
				vscode.window.showErrorMessage("An error occurred while attempting to apply changes.")
			}
		});
	});
}

export function activate(context: vscode.ExtensionContext) {

	// register commands
	context.subscriptions.push(vscode.commands.registerCommand('typescriptsuggestions.suggest-types', getTypeSuggestions));
	context.subscriptions.push(vscode.commands.registerCommand('typescriptsuggestions.insert-type', insertType));

	// create status bar item (needed?)
	const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	item.text = "TypeScript Suggestions";
	item.command = "typescriptsuggestions.suggest-types";
	item.show();
	context.subscriptions.push(item);
}

// called when extension is deactivated
export function deactivate() {}