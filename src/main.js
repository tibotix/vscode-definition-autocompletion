const vscode = require('vscode');
const {update_symbol_index, symbol_index, update_first_time} = require("./symbol");
const { is_source_file } = require("./file");


let conf = vscode.workspace.getConfiguration("definition-autocompletion");



function create_completions(symbols, delete_range){
	const completions = [];
	for(let i=0; i<symbols.length; i++){
		const comp = new vscode.CompletionItem(symbols[i].full_name, symbols[i].kind);
		comp.insertText = new vscode.SnippetString(symbols[i].signature + symbols[i].get_insert_text());
		comp.detail = symbols[i].signature;
		comp.additionalTextEdits = [vscode.TextEdit.delete(delete_range)];
		completions.push(comp);
	}
	return completions;
}

function activate(context) {

	// console.log("Definition Autocompletion activated");

	if(conf.get("update_index_on_save")){
		context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(update_symbol_index));
	}

	if(conf.get("update_index_on_change")){
		context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((document) => {return update_symbol_index(document.document);}));
	} else {
		context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((document) => {return update_first_time(document.document);}));
	}

	// TODO: maybe add more events and settings for custom additional autocompletion text

	const trigger_char = conf.get("trigger_character");
	
	const provider = vscode.languages.registerCompletionItemProvider("cpp", {
		provideCompletionItems(document, position, token, context){
			// only trigger when the trigger character is triggered
			if(context.triggerKind != vscode.CompletionTriggerKind.TriggerCharacter){
				// console.log("wrong trigger kind");
				return null;
			}

			// console.log("'" + document.lineAt(position).text + "'");


			// only trigger when line is . is the only character in the line
			if(! document.lineAt(position).text.match(/^(\s*)\.$/g)){
				// console.log("don't match!");
				return null;
			}

			const delete_range = new vscode.Range(position, position.translate(0, -1));

			const uri = document.uri;
			
			if(! is_source_file(uri)){
				// console.log("is not a source file...");
				return null;
			}

			
			const symbols = symbol_index[uri.toString()];
			// console.log("got symbols for current file");
			// console.log(symbols);

			return new Promise(
				function(resolve, reject){
					if(symbols !== undefined){
						resolve(create_completions(symbols, delete_range));
					} else {
						resolve(null);
					}
				}
			);

		}
	}, trigger_char);

	context.subscriptions.push(provider);

	const update_interval = conf.get("update_index_interval");
	if(update_interval !== 0){
		setInterval(() => {update_symbol_index(vscode.window.activeTextEditor.document)}, update_interval*1000);
	}
	

}

function deactivate() {}

module.exports = {
	deactivate,
	activate
}
