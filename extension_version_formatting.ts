import * as vscode from 'vscode';
import * as ts from 'typescript';
import * as os from 'os';
import * as fs from "fs";

function createDefaultFormatCodeSettings(): ts.FormatCodeSettings {

    return {
        baseIndentSize: 0,
        indentSize: 4,
        tabSize: 4,
        indentStyle: ts.IndentStyle.Smart,
        newLineCharacter: "\r\n",
        convertTabsToSpaces: true,
        insertSpaceAfterCommaDelimiter: true,
        insertSpaceAfterSemicolonInForStatements: true,
        insertSpaceBeforeAndAfterBinaryOperators: true,
        insertSpaceAfterConstructor: false,
        insertSpaceAfterKeywordsInControlFlowStatements: true,
        insertSpaceAfterFunctionKeywordForAnonymousFunctions: false,
        insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: false,
        insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: false,
        insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
        insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false,
        insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces: false,
        insertSpaceAfterTypeAssertion: false,
        insertSpaceBeforeFunctionParenthesis: false,
        placeOpenBraceOnNewLineForFunctions: false,
        placeOpenBraceOnNewLineForControlBlocks: false,
        insertSpaceBeforeTypeAnnotation: false,
    };
}

var wordStart: any;
var global_position: any;
var editorDocument: vscode.TextDocument;
//Create output channel
var typeSuggestions = ["Type1", "Type2", "Type3", "Type4", "Type5"]; // init placeholders, updated later
var document_position = null;
var global_document = null;
var word_of_interest = null;
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
	vscode.languages.registerHoverProvider('typescript', {
		provideHover: async (document, position) => {
			// not necessary if we want pass source to typescript compiler this could be a todo;
			// process would be: load source, load project files, delete current file from list of files, insert string as source, build
			document.save(); // not necessary if we want pass source to typescript compiler
			word_of_interest = document.getText(document.getWordRangeAtPosition(position));
			wordStart = document.getWordRangeAtPosition(position)?.start;

			console.log('** Curr position: \n', position);
			console.log('** Curr word: \n', word_of_interest);
			console.log("WORD START: "+wordStart.character);
			document_position = document.offsetAt(wordStart);
			global_position = wordStart;
			global_document = global_document;
			console.log("AST LOCATION: "+document_position);
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
			
			var params = {input_string:in_str, word_index: word_in};

			const fetch = require('node-fetch');
			const response = await fetch('http://localhost:5000/suggest-types?' 
				+ new URLSearchParams(params).toString());
			const data = await response.json();
			console.log(data);

			typeSuggestions = data.type_suggestions;
			console.log(typeSuggestions);

			console.log(data.probabilities);
			// process probabilities (round to 3 decimal places, percentage, toString)
			var typeProbabilities: string[] = [];
			for(const p of data.probabilities) {
				var currProb = (Math.round((p + Number.EPSILON) * 1000)/10).toString() + "%";
				typeProbabilities.push(currProb);
				// note: general expression to round to 3 decimal(Math.round((p + Number.EPSILON) * 1000) / 1000) - changed denom to 10 above to make %
			}
			console.log(typeProbabilities);

			// build hover MarkdownString with all five type suggestions   // TODO: add probabilities?
			const markdownTypes = new vscode.MarkdownString();
			markdownTypes.appendMarkdown('***Suggested Types:***\n\n');

			for (let i = 0; i < typeSuggestions.length; i++) {
                markdownTypes.appendMarkdown('**' + typeSuggestions[i] + '** *(' + typeProbabilities[i] + ')............press \`Shift\`+\`'+(i+1)+'\` to accept*\n\n');
            }
			// display type suggestions and acceptance keystrokes in hover
			return new vscode.Hover(markdownTypes);
		}
	});
}



function insertTypeHelper(type:string, loc:number, word:string):any {
    function incrementalCompile(dir:string, file:string): any {
        const configPath = ts.findConfigFile(dir,
        ts.sys.fileExists,
        "tsconfig.json"
        );
        if (configPath) {
			const host: ts.ParseConfigFileHost = ts.sys as any;
        	const config = ts.getParsedCommandLineOfConfigFile(configPath, { incremental: true }, host);
			var project = ts.createIncrementalProgram({
				rootNames: config.fileNames,
				options: config.options,
				configFileParsingDiagnostics: ts.getConfigFileParsingDiagnostics(config),
				projectReferences: config.projectReferences
			});
		
			// let program = ts.createProgram(config.fileNames, config.options);
			return [project, config];
		}else {
			throw new Error("Could not find a valid 'tsconfig.json'.");
			//options = {noEmitOnError: true,target: ts.ScriptTarget.ES5,module: ts.ModuleKind.CommonJS, incremental: true}
			//add single line for compileing with targetfile
		}
        
        
    }
	//function insert(languageServiceHost: ts.LanguageServiceHost, sourceFile:ts.SourceFile, type:string, loc:number, word:string):any {
	function insert(languageServiceHost: ts.LanguageServiceHost, sourceFile:ts.SourceFile, type:string, loc:number, word:string):any {
		// let checker = program.getTypeChecker();
		var tokens = [];
		var inferred_type = null;
		var quickReturn = false;
		var match_identifier = false;
		var text = sourceFile.getFullText();
		console.log(text);


		function getType(deeplearnerType:string) {
			let source = `var t: ` + deeplearnerType + ` = null;`;
			const sourceFile: ts.SourceFile = ts.createSourceFile('test.ts', source, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TS);
			return sourceFile.getChildren()[0].getChildren()[0].getChildren()[0].getChildren()[1].getChildren()[0]["type"];
		}
		const transformer = <T extends ts.Node>(context: ts.TransformationContext) => (rootNode: T) => {
			function visit(node: ts.Node): ts.Node {
				// getType(type);
				if (quickReturn || match_identifier){
					return node;
				}
				for (var child of node.getChildren(sourceFile)) {
					visit(child);
				}

				if (node.kind == ts.SyntaxKind.Identifier) {
					if (node.getText() == word && (node.pos<loc+20 && node.pos>loc-20)){
						match_identifier = true;
						
					}
				}else if (match_identifier && (node.kind == ts.SyntaxKind.FunctionDeclaration || node.kind == ts.SyntaxKind.MethodDeclaration)){
					node["type"] = getType(type);
					quickReturn = true;
					match_identifier = false;

				}else if (match_identifier && (node.kind == ts.SyntaxKind.VariableDeclaration || node.kind == ts.SyntaxKind.Parameter)) {
					node["type"] = getType(type);
					quickReturn = true;
					match_identifier = false;
                }

				return node;
			}
			return ts.visitNode(rootNode, visit);
		};
		const result: ts.TransformationResult<ts.SourceFile> = ts.transform<ts.SourceFile>(sourceFile, [transformer]);
		const transformedSourceFile: ts.SourceFile = result.transformed[0];
		console.log("HERE IS T_FILE " + sourceFile.fileName);


		const scriptSnapshot = languageServiceHost.getScriptSnapshot(sourceFile.fileName);
		const version = languageServiceHost.getScriptVersion(sourceFile.fileName);

		if (!scriptSnapshot) {
			// The host does not know about this file.
			throw new Error("Could not find file: '" + sourceFile.fileName + "'.");
		}
		const printer: ts.Printer = ts.createPrinter();
		// return printer.printFile(transformedSourceFile);
		var newText = printer.printFile(transformedSourceFile);
		var textSourceFile = ts.createSourceFile(sourceFile.fileName, newText, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TS);
		const transformedScriptSnapshot =  languageServiceHost.getScriptSnapshot(textSourceFile.getFullText());
		
		
		
		const editRange = scriptSnapshot.getChangeRange(transformedScriptSnapshot);
		sourceFile = ts.updateLanguageServiceSourceFile(textSourceFile, scriptSnapshot,version, editRange);


		const languageService = ts.createLanguageService(languageServiceHost, ts.createDocumentRegistry());

		let options =createDefaultFormatCodeSettings();
		const edits = languageService.getFormattingEditsForDocument(sourceFile.fileName,  options);
		console.log("EDITS: " + edits.length);
		for (const edit of edits) {
			console.log(encodeURIComponent(edit.newText));
		}
		// edits
		// 	.sort((a, b) =>  b.span.start- a.span.start)
		// 	.reverse()
		// 	.forEach(edit => {
		// 		const head = newText.slice(0, edit.span.start);
		// 		const tail = newText.slice(edit.span.start + edit.span.length);
		// 		newText = `${head}${edit.newText}${tail}`;
		// 	});
		// console.log(newText);
		return newText;
		// const printer: ts.Printer = ts.createPrinter();
		// text = printer.printFile(transformedSourceFile);
		// return transformedSourceFile;

	}

	let dir = vscode.workspace.workspaceFolders[0].uri.path ;
	let currentFile = vscode.window.activeTextEditor.document.fileName;
    var project_return = incrementalCompile(dir, currentFile);
	var project = project_return[0];
	var config = project_return[1];
	var program = project.getProgram();

	var sourcefile = program.getSourceFile(currentFile);
	// const host = new LanguageServiceHost();
    // // host.addFile(currentFile, sourcefile.getFullText);

    // const languageService = ts.createLanguageService(host);
	// console.log("LANGUAGE SERVICE" + typeof(languageService));
	// var tfile  = insert(program, sourcefile,type, loc);

	
	const files: ts.MapLike<{ version: number }> = {};

	// initialize the list of files
  
	files[currentFile] = { version: 0 };


// Create the language service host to allow the LS to communicate with the host
	const servicesHost: ts.LanguageServiceHost = {
		getScriptFileNames: () => [currentFile],
		getScriptVersion: fileName =>
		files[fileName] && files[fileName].version.toString(),
		getScriptSnapshot: fileName => {
		if (!fs.existsSync(fileName)) {
			return undefined;
		}

		return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName).toString());
		},
		getCurrentDirectory: () => process.cwd(),
		getCompilationSettings: () => config.options,
		getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
		fileExists: ts.sys.fileExists,
		readFile: ts.sys.readFile,
		readDirectory: ts.sys.readDirectory,
		directoryExists: ts.sys.directoryExists,
		getDirectories: ts.sys.getDirectories,
	};


	return insert(servicesHost, sourcefile,type, loc, word);

	// console.log("HERE IS T_FILE"+ typeof(tfile));
	// var printer: ts.Printer = ts.createPrinter();
	// return printer.printFile(tfile);
}

function insertType(typeNum:number) {
	console.log("** Inserting type #", typeNum);
	console.log("** Type:", typeSuggestions[typeNum-1]);
	console.log("** Type Location:", document_position);
	console.log("** Type Location:", word_of_interest);
	// var file_updated = insertTypeHelper(typeSuggestions[typeNum-1], document_position-1);
	// vscode.window.activeTextEditor.edit(builder => {
	// 	const doc = vscode.window.activeTextEditor.document;
	// 	builder.replace(new vscode.Range(doc.lineAt(0).range.start, doc.lineAt(doc.lineCount - 1).range.end), file_updated);
	// });
	vscode.window.showTextDocument(editorDocument).then((editor) => {
		editor.edit(editBuilder => {			
			var line2update = global_position.line;
			// var line_updated = insertTypeHelper(typeSuggestions[typeNum-1], document_position, word_of_interest).split(os.EOL)[line2update]+"\n";
			// const start_p = new vscode.Position(global_position.line,0);
			// const end_p = new vscode.Position(global_position.line+1,0);
			// console.log(line_updated);
			// //in v2 look to replace span of line by splitting on line number and replacing that line with position variable
			// //this replaces entire file, but is a cop out.
			// vscode.window.activeTextEditor.edit(builder => {
			// 	const doc = vscode.window.activeTextEditor.document;
			// 	//builder.replace(new vscode.Range(doc.lineAt(0).range.start, doc.lineAt(doc.lineCount - 1).range.end), file_updated);
			// 	builder.replace(new vscode.Range(start_p, end_p), line_updated);
			// 	doc.save();
			// });
			
			var line_updated = insertTypeHelper(typeSuggestions[typeNum-1], document_position, word_of_interest)
			vscode.window.activeTextEditor.edit(builder => {
				const doc = vscode.window.activeTextEditor.document;
				builder.replace(new vscode.Range(doc.lineAt(0).range.start, doc.lineAt(doc.lineCount - 1).range.end), line_updated);
				doc.save();
			});

		}).then((applied) => {
			if(!applied) {
				vscode.window.showErrorMessage("An error occurred while attempting to apply changes.");
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