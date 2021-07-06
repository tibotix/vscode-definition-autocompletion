// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const { glob } = require('glob');
const vscode = require('vscode');

async function is_header_file(uri){
	return await uri.path.match(".*(h$|hpp$)");
}

async function is_source_file(uri){
	return await uri.path.match(".*(c$|cpp$)");
}


class SourceFile{
	static async get(uri, header_file){
		if(source_files.hasOwnProperty(uri.toString())){
			console.log("returning cached source_file");
			return source_files[uri.toString()];
		}
		let source_file = new SourceFile(uri, header_file);
		source_files[uri.toString()] = source_file;
		return source_file;
	}

	constructor(uri, header_file){
		this.uri = uri;
		this.header_file = header_file;
	}
};

class HeaderFile{
	static async get(uri){
		if(header_files.hasOwnProperty(uri.toString())){
			console.log("returning cached header_file");
			return header_files[uri.toString()];
		}
		let header_file = new HeaderFile(uri);
		header_files[uri.toString()] = header_file;
		await header_file.find_source_file().then(
			async function(source_uri){
				console.log("Found SourceFile: " + source_uri[0].toString());
				header_file.source_file = await SourceFile.get(source_uri[0], this);
			}
		);
		return header_file;
	}

	constructor(uri) {
		this.uri = uri;
		this.ending = uri.path.substring(uri.path.lastIndexOf("."));
		this.beginning = uri.path.substring(0, uri.path.lastIndexOf("."));
		this.file_name = uri.path.substring(uri.path.lastIndexOf("/")+1, uri.path.lastIndexOf("."));
		this.source_file = null;
	}

	async find_source_file(){
		console.log("searching SourceFile for: " + this.uri.toString());
		const include_pattern = "**/" + this.file_name + ".{c,cpp}";
		console.log(include_pattern);
		if(vscode.workspace.name === undefined){
			return new Promise(
				async function(resolve, reject){
					await glob(include_pattern, { matchBase: true}, function(err, files){
						console.log(files);
						if(err){
							reject("");
						} else {
							resolve(files.map(function(path){return vscode.Uri.file(path);}));
						}
					});
				}
			);
		}
		return vscode.workspace.findFiles(include_pattern, "", 2);
	}
};


class Symbol{
	constructor(symbol_obj, document){
		//console.log("symbol_obj: ");
		//console.log(symbol_obj);
		this.range_very_end = symbol_obj.range.end;
		this.range_very_start = symbol_obj.range.start;
		this.range_end = symbol_obj.selectionRange.end;
		this.range_start = symbol_obj.selectionRange.start;
		this.is_declaration = document.lineAt(this.range_very_end).text.trimEnd().endsWith(";");
		this.is_deleted = document.lineAt(this.range_very_end).text.trimEnd().endsWith("delete;");
		this.is_defaulted = document.lineAt(this.range_very_end).text.trimEnd().endsWith("default;");
		this.insert_signature = document.lineAt(this.range_very_end).text.substring(this.range_very_start.character, this.range_very_end.character-1);
		this.clear_signature();
		// this.whole_signature = document.lineAt(this.range_end).text.substring(this.range_very_start.character, this.range_end.character);
		this.kind = symbol_obj.kind;
		this.name = symbol_obj.name;
	}

	clear_signature(){
		// TODO: add more attributes
		this.insert_signature = this.insert_signature.replace(" override", "").replace("virtual ", "").replace("[[nodiscard]] ").replace("explicit ", "").replace("static ", "").replace("inline ", "");
	}

	is_symbol_with_no_definition(){
		return (this.is_declaration && !this.is_defaulted && !this.is_deleted);
	}
};

async function symbols_for(uri){
	return await vscode.commands.executeCommand("vscode.executeDocumentSymbolProvider", uri);
}

var symbol_index = new Object(); // contains only declaration symbols
var header_files = new Object(); // to cache already found header files and their associated source files
var source_files = new Object();


async function parse_header_symbol(symbol, flatted_symbols, document){
	const children = symbol.children;
	for(let i=0; i<children.length; i++){
		if(children[i].kind == 11 || children[i].kind == 5){ // maybe operator 24 , maybe constructor 8	
			const s = new Symbol(children[i], document);
			if(s.is_symbol_with_no_definition()){
				flatted_symbols.push(s);
			}
		}
		await parse_header_symbol(children[i], flatted_symbols, document);
	}
}

async function flatten_header_symbols(symbols){
	const flatted_symbols = [];
	// maybe use vscode.SignatureInformation

	if(!vscode.window.activeTextEditor){
		return flatted_symbols;
	}

	const document = vscode.window.activeTextEditor.document;
	await parse_header_symbol({children: symbols}, flatted_symbols, document);
	return flatted_symbols;
}

async function dif_symbols(header_symbols, source_symbols){
	return header_symbols.filter(x => !source_symbols.includes(x));
}



async function update_symbol_index_for(header_uri){
	// TODO: update cpp symbols if is_source_file

	// only update if file is h/hpp
	if(! await is_header_file(header_uri)){
		console.log("no header file... ignoring");
		return;
	}
	
	await symbols_for(header_uri).then(
		async function(header_symbols){
			if(!header_symbols){
				return;
			}

			const header_file = await HeaderFile.get(header_uri);
			if(header_file.source_file == null){
				return;
			}

			await symbols_for(header_file.source_file.uri).catch(function(err){ console.log(err); }).then(
				async function(source_symbols){
					if(!source_symbols){
						return;
					}

					// console.log(source_symbols);

					const flatten_header_symbols_ = await flatten_header_symbols(header_symbols);
					// const flatten_source_symbols_ = await flatten_header_symbols(source_symbols);
					// console.log("flatten header symbols: ");
					// console.log(flatten_header_symbols_);
					// console.log("flatten source symbols: ");
					// console.log(flatten_source_symbols_);
					// const unique_symbols = await dif_symbols(flatten_header_symbols_, flatten_source_symbols_);
					// console.log("unique elements: ");
					// console.log(unique_symbols);
					symbol_index[header_file.source_file.uri.toString()] = flatten_header_symbols_;
					console.log("updated symbol index!");
				}
			);
		}
	);
}

async function update_symbol_index(){
	if(!vscode.window.activeTextEditor){
		return;
	}
	const header_uri = vscode.window.activeTextEditor.document.uri;
	await update_symbol_index_for(header_uri);
}



let conf = vscode.workspace.getConfiguration("definition-autocompletion");

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

	console.log("Definition Autocompleter activated");

	if(conf.get("update_index_on_save")){
		context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(update_symbol_index));
	}
	
	if(conf.get("update_index_on_open")){
		context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(update_symbol_index));
	}

	if(conf.get("update_index_on_change")){
		context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(update_symbol_index));
	}

	const trigger_char = conf.get("trigger_character");
	
	const provider = vscode.languages.registerCompletionItemProvider("cpp", {
		async provideCompletionItems(document, position, token, context){
			// only trigger when the trigger character is triggered
			if(context.triggerKind != vscode.CompletionTriggerKind.TriggerCharacter){
				console.log("wrong trigger kind");
				return null;
			}

			console.log("'" + document.lineAt(position).text + "'");


			// only trigger when line is . is the only character in the line
			if(! document.lineAt(position).text.match(/^(\s*)\.$/g)){
				console.log("don't match!");
				return null;
			}

			const delete_range = new vscode.Range(position, position.translate(0, -1));

			const uri = document.uri;
			
			if(! await is_source_file(uri)){
				console.log("is not a source file...");
				return null;
			}

			var completions = [];
			const symbols = symbol_index[uri.toString()];

			console.log("got symbols for current file");
			console.log(symbols);

			for(let i=0; i<symbols.length; i++){
				// TODO: push symbols that are not already defined yet in header / source file
				// TODO: support templates
				// TODO: only show useful completions (namespaces / classes / etc.)
				// TODO: support class member functions with class::function ...
				const comp = new vscode.CompletionItem(symbols[i].name, symbols[i].kind);
				comp.insertText = new vscode.SnippetString(symbols[i].insert_signature + " {\n\t$0\n}");
				// comp.detail = "detail"; // TODO: maybe some details
				comp.additionalTextEdits = [vscode.TextEdit.delete(delete_range)];
				completions.push(comp);
			}
			return completions;
		}
	}, trigger_char);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	// let disposable = vscode.commands.registerCommand('definition-autocompletion.helloWorld', function () {
	// 	// The code you place here will be executed every time your command is executed

	// 	// Display a message box to the user
	// 	vscode.window.showInformationMessage('Hello World from Definition Autocompletion!');
	// });

	// context.subscriptions.push(disposable);
	context.subscriptions.push(provider);

	update_symbol_index();
}

// this method is called when your extension is deactivated
async function deactivate() {}

module.exports = {
	deactivate,
	activate
}
