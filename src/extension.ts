import * as vscode from 'vscode';
import * as ts from 'typescript';

var wordStart: any;
var editorDocument: vscode.TextDocument;
//Create output channel
var typeSuggestions = ["Type1", "Type2", "Type3", "Type4", "Type5"]; // init placeholders, updated later
var complete_list_of_types = [];
var document_position = null;
var word_of_interest = null;
var project = null;
var program = null;

let basicTypes = new Map<ts.SyntaxKind, string>();
basicTypes.set(ts.SyntaxKind.BooleanKeyword, "boolean");
basicTypes.set(ts.SyntaxKind.BooleanKeyword, "boolean");
basicTypes.set(ts.SyntaxKind.TrueKeyword, "boolean");
basicTypes.set(ts.SyntaxKind.FalseKeyword, "boolean");
basicTypes.set(ts.SyntaxKind.NumberKeyword, "number");
basicTypes.set(ts.SyntaxKind.StringKeyword, "string");
basicTypes.set(ts.SyntaxKind.SymbolKeyword, "symbol");
basicTypes.set(ts.SyntaxKind.EnumKeyword, "enum");
basicTypes.set(ts.SyntaxKind.VoidKeyword, "void");
basicTypes.set(ts.SyntaxKind.ObjectKeyword, "object");
basicTypes.set(ts.SyntaxKind.BigIntKeyword, "bigint");
basicTypes.set(ts.SyntaxKind.UndefinedKeyword, "undefined");
basicTypes.set(ts.SyntaxKind.NullKeyword, "null");

let ignoredTypes = new Set<ts.SyntaxKind>();
ignoredTypes.add(ts.SyntaxKind.MappedType);
ignoredTypes.add(ts.SyntaxKind.ConditionalType);
ignoredTypes.add(ts.SyntaxKind.ThisType);
ignoredTypes.add(ts.SyntaxKind.UnknownKeyword);
ignoredTypes.add(ts.SyntaxKind.IndexedAccessType);
ignoredTypes.add(ts.SyntaxKind.UndefinedKeyword);
ignoredTypes.add(ts.SyntaxKind.NeverKeyword);
ignoredTypes.add(ts.SyntaxKind.TypeOperator);
// ignoredTypes.add(ts.SyntaxKind.NullKeyword);
ignoredTypes.add(ts.SyntaxKind.IntersectionType);
ignoredTypes.add(ts.SyntaxKind.TypeQuery);
function parseDeclarationName(n: ts.DeclarationName): string {
  switch (n.kind) {
    case ts.SyntaxKind.Identifier:
      return n.text;
    case ts.SyntaxKind.StringLiteral:
      return n.text;
    case ts.SyntaxKind.NumericLiteral:
      return n.text;
    default:
      return "UnhandledDeclarationName";
  }
}

function parseTVars(n: { typeParameters?: ts.NodeArray<ts.TypeParameterDeclaration> }): string[] {
  return n.typeParameters ? n.typeParameters.map(p => p.name.text) : [];
}

// function parseSignatureType(sig: ts.SignatureDeclarationBase) {
//   let tVars = parseTVars(sig);
//   let argTypes = sig.parameters.map(p => p.type ? parseType(p.type) : "any");
//   let retType = sig.type ? parseType(sig.type) : "void";
//   // return new FuncType(argTypes, retType);
// }

// function parseTypeMember(member: ts.NamedDeclaration){
//   if (member.name) {
//     if (ts.SyntaxKind.PropertyDeclaration == member.kind || ts.SyntaxKind.PropertySignature == member.kind) {
//       const x = (member as ts.PropertyDeclaration | ts.PropertySignature);
//       let b = x.type ? parseType(x.type) : "any"
//       let c =parseDeclarationName(x.name)
//       let a = {};
//       a[c]= b
//       return a;
//     } 
//   }
// }

function parseEntityName(n: ts.EntityName): string {
  if (n.kind === ts.SyntaxKind.Identifier) {
    return n.text;
  } else {
    return parseEntityName(n.left) + "." + n.right.text;
  }
}

function parseType(node: ts.TypeNode) {
  var type=undefined;
  if (node.kind === ts.SyntaxKind.AnyKeyword || node.kind === ts.SyntaxKind.ThisKeyword) {
      return "any";
  } else if (ts.isTypeReferenceNode(node)) {
    let n = node as ts.TypeReferenceNode;
    type = parseEntityName(n.typeName);
  }else if (basicTypes.has(node.kind)) {
    type = basicTypes.get(node.kind);
  }else if (node.kind === ts.SyntaxKind.ArrayType) { 
      type =  "array";
  }else if (node.kind === ts.SyntaxKind.TypeLiteral) {
      let n = node as ts.TypeLiteralNode;
      return "object";
  } else if (node.kind === ts.SyntaxKind.FunctionType || node.kind === ts.SyntaxKind.ConstructorType) {
      let n = node as ts.FunctionOrConstructorTypeNode;
      let ret = parseType(n.type);
      type = ret;
    } else if (node.kind === ts.SyntaxKind.UnionType) {
      let n = node as ts.UnionTypeNode;
      let typesofUnion=[];
      var i;
      for (i =0; i < n.types.length; i++) {
        typesofUnion.push(parseType(n.types[String(i)]));
      }
      typesofUnion = [...new Set(typesofUnion)];
      typesofUnion = typesofUnion.filter(function(x){
        return x !== 'any';
      });
      if (typesofUnion.length === 2) {
        if (typesofUnion[1] === "null" || typesofUnion[1] === "undefined") {
          return typesofUnion[0];
        }else{
          return 'any';
        }
      }else if (typesofUnion.length === 1)  {
        return typesofUnion[0];
      }else{
        return 'any';
      }
  } else if (ignoredTypes.has(node.kind)) {
      return "any"; 
  } else if (node.kind === ts.SyntaxKind.LiteralType) {
      let n = node as ts.LiteralTypeNode;
      switch (n.literal.kind) {
        case ts.SyntaxKind.StringLiteral:
          return "string";
        case ts.SyntaxKind.TrueKeyword:
        case ts.SyntaxKind.FalseKeyword:
          return "boolean";
        case ts.SyntaxKind.NumericLiteral:
          return "number";
        case ts.SyntaxKind.NullKeyword:
          return "null";
        default:
          return "any";
      }
  } else if (node.kind === ts.SyntaxKind.ParenthesizedType) {
    let n = node as ts.ParenthesizedTypeNode;
    return parseType(n.type);
  } else if (node.kind === ts.SyntaxKind.FirstTypeNode || node.kind === ts.SyntaxKind.LastTypeNode) {
    type = "boolean";
  } else if (node.kind === ts.SyntaxKind.TupleType) {
    type =  "array";
  }else{
    type = "any";
  }
  return type;
}



function incrementalCompile(dir:string): any {
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
		return project;
	}else {
		throw new Error("Could not find a valid 'tsconfig.json'.");
	}
}
function fast_linter(checker: ts.TypeChecker, sourceFile:ts.SourceFile, loc, word){
	var tokens = [];
	var inferred_type = undefined;
	var word_index = undefined;
	var typeCache = undefined;
	function visit(node: ts.Node): ts.Node {

		if (node.kind === ts.SyntaxKind.Identifier) {
			if (node.getText() === word && (node.pos<loc+20 && node.pos>loc-20)){
				word_index = tokens.length-1;
				inferred_type = typeCache;
			}
		}else if (node.kind === ts.SyntaxKind.VariableDeclaration || (node.kind === ts.SyntaxKind.Parameter && node.parent.kind !== ts.SyntaxKind.FunctionType) ||	 node.kind === ts.SyntaxKind.FunctionDeclaration || node.kind === ts.SyntaxKind.MethodDeclaration) {		
			if (node.hasOwnProperty('name')) {
				let symbol = checker.getSymbolAtLocation(node['name']);
				if (symbol) {
					const ty = checker.getTypeAtLocation(node);
					const n = checker.typeToTypeNode(ty, undefined, undefined); //not sure why this says error on vscode...
					typeCache = parseType(n);
				}
			}
		}

		for (var child of node.getChildren(sourceFile)) {
			if (child.getChildren().length === 0 && child.getText().length>0){
				tokens.push(child.getText());
			}
			visit(child);
		}

		return node;
	}
	ts.visitNode(sourceFile, visit);
	return [tokens, inferred_type, word_index];
}

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
			// not necessary if we want pass source to typescript compiler
			word_of_interest = document.getText(document.getWordRangeAtPosition(position));
			wordStart = document.getWordRangeAtPosition(position)?.start;

			console.log('** Curr position: \n', position);
			console.log('** Curr word: \n', word_of_interest);
			console.log("WORD START: "+wordStart.character);
			document_position = document.offsetAt(wordStart);
			console.log("AST POS Location (approx): "+document_position);
			// send http request, receive type suggestions from model server

			let dir = vscode.workspace.workspaceFolders[0].uri.path ;
			let currentFile = vscode.window.activeTextEditor.document.fileName;
			project = incrementalCompile(dir);
			program = project.getProgram();
			var sourcefile = program.getSourceFile(currentFile);
			let checker = program.getTypeChecker();
			let tokens_and_inferred = fast_linter(checker, sourcefile, document_position, word_of_interest);
			var tokens = tokens_and_inferred[0];
			var inferred_type = tokens_and_inferred[1];
			console.log("INFERRED TYPE: "+inferred_type);
			var word_index = tokens_and_inferred[2];
			console.log("WORD INDEX:" +word_index);
			// var in_str = editorDocument.lineAt(position).text; // passing in current line as input for now -- kevin we don't need this now that we have tokens!
			
			// var word_in: string = position.character.toString(); // we have word index now!!
			//var params = {input_string:tokens.join(' '), word_index: word_index};
			var params = {input_string:JSON.stringify(tokens), word_index: word_index};


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
			complete_list_of_types = typeSuggestions;
			var list_offset = 0;
			if (inferred_type !== undefined){
				markdownTypes.appendMarkdown('***Inferred Types:***\n\n');
				markdownTypes.appendMarkdown('**' + inferred_type + '** ............press \`Shift\`+\`'+(1)+'\` to accept*\n\n');
				complete_list_of_types = [inferred_type].concat(typeSuggestions);
				list_offset=1;
			}
			markdownTypes.appendMarkdown('***Suggested Types:***\n\n');
			for (let i = 0; i < typeSuggestions.length; i++) {
                markdownTypes.appendMarkdown('**' + typeSuggestions[i] + '** *(' + typeProbabilities[i] + ')............press \`Shift\`+\`'+(i+1+list_offset)+'\` to accept*\n\n');
            }

			// display type suggestions and acceptance keystrokes in hover
			return new vscode.Hover(markdownTypes);
		}
	});
}

function insertTypeHelper(project, type:string, loc:number, word:string):any {
	function insert(sourceFile:ts.SourceFile, type:string, loc:number, word:string):any {
		// 
		var quickReturn = false;
		var match_identifier = false;
		var text = sourceFile.getFullText();
		function getType(deeplearnerType:string) {
			let source = `var t: ` + deeplearnerType + ` = null;`;
			const sourceFile: ts.SourceFile = ts.createSourceFile('test.ts', source, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TS);
			return sourceFile.getChildren()[0].getChildren()[0].getChildren()[0].getChildren()[1].getChildren()[0]["type"];
		}
		const transformer = <T extends ts.Node>(context: ts.TransformationContext) => (rootNode: T) => {
			function visit(node: ts.Node): ts.Node {
				if (quickReturn || match_identifier){
					return node;
				}
				for (var child of node.getChildren(sourceFile)) {
					visit(child);
				}

				if (node.kind === ts.SyntaxKind.Identifier) {
					if (node.getText() === word && (node.pos<loc+20 && node.pos>loc-20)){
						match_identifier = true;
						
					}
				}else if (match_identifier && (node.kind === ts.SyntaxKind.FunctionDeclaration || node.kind === ts.SyntaxKind.MethodDeclaration)){
					node["type"] = getType(type);
					quickReturn = true;
					match_identifier = false;

				}else if (match_identifier && (node.kind === ts.SyntaxKind.VariableDeclaration || node.kind === ts.SyntaxKind.Parameter)) {
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
		const printer: ts.Printer = ts.createPrinter();
		return printer.printFile(transformedSourceFile);
	}

	var program = project.getProgram();
	let currentFile = vscode.window.activeTextEditor.document.fileName; //could pass as global but this is fine.
	var sourcefile = program.getSourceFile(currentFile);
	return insert(sourcefile,type, loc, word);
}

function insertType(typeNum:number) {
	console.log("** Inserting type #", typeNum);
	console.log("** Type:", complete_list_of_types[typeNum-1]);
	console.log("** Type Location:", document_position);
	console.log("** Type Word Location:", word_of_interest);
	vscode.window.showTextDocument(editorDocument).then((editor) => {
		editorDocument = editor.document;
		editor.edit(editBuilder => {
			editorDocument.save(); //save any changes the user might have made prior to insert
			var line_updated = insertTypeHelper(project, complete_list_of_types[typeNum-1], document_position, word_of_interest);
			vscode.window.activeTextEditor.edit(builder => {
				builder.replace(new vscode.Range(editorDocument.lineAt(0).range.start, editorDocument.lineAt(editorDocument.lineCount - 1).range.end), line_updated);
			});
			editorDocument.save(); //save any changes we made. ideally we would just change the editor but the typescript api takes in from path. we can TODO change this.

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

	// hide extension activation cmd from cmd palette (so can't be activated more than once)
	vscode.commands.executeCommand('setContext', 'myExtension.hideActivationCommand', true);
}

// called when extension is deactivated
export function deactivate() {}