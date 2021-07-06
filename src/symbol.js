const vscode = require('vscode');
const {HeaderFile, is_header_file} = require("./file");


var symbol_index = new Object(); // contains only declaration symbols

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

async function filter_unique_header_symbols(header_symbols, source_symbols){
    const unique_header_symbols = [];
    for(let i=0; i!=header_symbols.length; ++i){
        let unique = true;
        for(let j=0; j!=source_symbols.length; ++i){
            if(header_symbols[i].equals(source_symbols[j])){
                unique = false;
                break;
            }
        }
        if(unique){
            unique_header_symbols.push(header_symbols[i]);
        }
    }
	return unique_header_symbols;
}


async function update_symbol_index_for_header(header_uri){
    console.log("update symbol index for: " + header_uri.toString());
	// TODO: update cpp symbols if is_source_file

	// only update if file is h/hpp
	if(! await is_header_file(header_uri)){
		console.log("no header file... ignoring");
		return;
	}
	
	await symbols_for(header_uri).then(
		async function(header_symbols){
			if(!header_symbols){
                console.log("no header symbols found!");
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
					// const unique_symbols = await filter_unique_header_symbols(flatten_header_symbols_, flatten_source_symbols_);
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
	await update_symbol_index_for_header(header_uri);
}


module.exports = {
	update_symbol_index,
    update_symbol_index_for_header,
	symbols_for,
    Symbol,
    symbol_index
}