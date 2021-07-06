const vscode = require('vscode');
const {update_symbol_index, symbol_index, update_symbol_index_for_header} = require("./symbol");
const { is_source_file, FileFinder} = require("./file");


let conf = vscode.workspace.getConfiguration("definition-autocompletion");



async function update_whole_workspace_index(){
	await (await (await (await (await new FileFinder().match_base()).max(20)).match_file_name("*")).match_extensions(["h", "hpp"])).find_files().then(
		async function(source_uri_array){
			for(let i=0; i!=source_uri_array.length; ++i){
				await update_symbol_index_for_header(source_uri_array[i]);
			}
		}
	);
}



async function activate(context) {

	console.log("Definition Autocompleter activated");

	if(conf.get("update_index_on_save")){
		context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(update_symbol_index));
	}

	if(conf.get("update_index_on_change")){
		context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(update_symbol_index));
	}

	// TODO: maybe add more events

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

	context.subscriptions.push(provider);

	setTimeout(update_whole_workspace_index, 10*1000); // after 10 seconds update whole workspace index
}

async function deactivate() {}

module.exports = {
	deactivate,
	activate
}
