const vscode = require('vscode');
const {FilePairFactory } = require("./file");
const { ContainerChain } = require('./container_chain');


var symbol_index = new Object(); // contains only declaration symbols

class SymbolFactory {
    constructor(document){
        this.document = document;
    }

    create_symbol_from_kind(symbol_obj, container_chain){
        switch (symbol_obj.kind) {
            case 11:
                return new FunctionSymbol(symbol_obj, this.document, container_chain);
            case 9:
                return new EnumSymbol(symbol_obj, this.document, container_chain);
            case 4:
                return new ClassSymbol(symbol_obj, this.document, container_chain);
            case 5:
                return new MethodSymbol(symbol_obj, this.document, container_chain);
            case 22:
                return new StructSymbol(symbol_obj, this.document, container_chain);
            default:
                return new Symbol(symbol_obj, this.document, container_chain);
        }
    }
};


class Symbol {

    constructor(symbol_obj, document, container_chain){
		// console.log("symbol_obj: ");
		// console.log(symbol_obj);
        let range_very_end = symbol_obj.range.end;
		let range_very_start = symbol_obj.range.start;
        
        this.ending_line = document.lineAt(range_very_end).text;
        // console.log(this.ending_line);
		this.signature = this.ending_line.substring(range_very_start.character, range_very_end.character-1);
        // console.log(this.signature);
        this.identifier_name_start = symbol_obj.selectionRange.start.character - range_very_start.character;
        this.container_chain = container_chain;
        this.apply_container_chain(container_chain);
        this.clear_attributes();
        this.ending_line = this.ending_line.trim();
        this.signature = this.signature.trim();
        // console.log(this.signature);

		this.kind = symbol_obj.kind;
		this.name = container_chain + symbol_obj.name;
	}

    clear_attributes(){
        this.signature = this.signature.replace(" override", "").replace("virtual ", "").replace("[[nodiscard]] ", "").replace("explicit ", "").replace("static ", "").replace("inline ", "");
    }

    apply_container_chain(container_chain){
        ;
    }

	is_symbol_with_no_definition(){
        return false;
	}

    is_container(){
        return false;
    }

    get_container_specifier(){
        return "";
    }

    equals(other){
        // 4 - 11
        return (this.name == other.name);
    }

};

class FunctionSymbol extends Symbol{ // without class
    constructor(symbol_obj, document, container_chain){
        super(symbol_obj, document, container_chain);
        // TODO: catch header definitions
        this.is_declaration = this.ending_line.endsWith(";");
		this.is_deleted = this.ending_line.endsWith("delete;");
		this.is_defaulted = this.ending_line.endsWith("default;");
        this.is_pure_virtual = this.ending_line.endsWith("0;");
    }

    apply_container_chain(container_chain){
        // as this is a function we do nothing
    }

	is_symbol_with_no_definition(){
        return (this.is_declaration && !this.is_defaulted && !this.is_deleted && !this.is_pure_virtual);
	}

};

class MethodSymbol extends Symbol{ // with class
    constructor(symbol_obj, document, container_chain){
        super(symbol_obj, document, container_chain);
        this.is_declaration = this.ending_line.endsWith(";");
		this.is_deleted = this.ending_line.endsWith("delete;");
		this.is_defaulted = this.ending_line.endsWith("default;");
        this.is_pure_virtual = this.ending_line.endsWith("0;");
    }

    apply_container_chain(container_chain){
        this.signature = this.signature.slice(0, this.identifier_name_start) + container_chain + this.signature.slice(this.identifier_name_start, this.signature.length);
    }

	is_symbol_with_no_definition(){
        return (this.is_declaration && !this.is_defaulted && !this.is_deleted && !this.is_pure_virtual);
	}
    
};

class StructSymbol extends Symbol{
    constructor(symbol_obj, document, container_chain){
        super(symbol_obj, document, container_chain);
    }

    is_container(){
        return true;
    }

    get_container_specifier(){
        return this.name;
    }
};

class ClassSymbol extends Symbol{
    constructor(symbol_obj, document, container_chain){
        super(symbol_obj, document, container_chain);
    }

    is_container(){
        return true;
    }

    get_container_specifier(){
        return this.name;
    }
};

class EnumSymbol extends Symbol{
    constructor(symbol_obj, document, container_chain){
        super(symbol_obj, document, container_chain);
    }

    is_container(){
        return true;
    }

    get_container_specifier(){
        return this.name;
    }
};


class SymbolParser{
    static parse_symbol_iteration(symbol_array, container_chain, parsed_symbols, symbol_creator){
        for(let i=0; i!=symbol_array.length; ++i){
            let symbol = symbol_creator.create_symbol_from_kind(symbol_array[i], container_chain);
            if(symbol.is_symbol_with_no_definition()){
                parsed_symbols.push(symbol);
            }
            SymbolParser.parse_symbol_iteration(symbol_array[i].children, container_chain.add_container(symbol.get_container_specifier()), symbol_creator);
        }
    }

    static parse_symbols(document, root_symbols){
        return new Promise(
            function(resolve, reject){
                let declaration_symbols = [];
                let definition_symbols = [];
                const symbol_creator = new SymbolFactory(document);

                const parse_symbol_iteration = (symbol_array, container_chain) => {
                    // console.log(container_chain);
                    // console.log(symbol_array);
                    for(let i=0; i!=symbol_array.length; ++i){
                        let symbol = symbol_creator.create_symbol_from_kind(symbol_array[i], container_chain);
                        // console.log(symbol);
                        if(symbol.is_symbol_with_no_definition()){
                            declaration_symbols.push(symbol);
                        } else {
                            definition_symbols.push(symbol);
                        }
                        parse_symbol_iteration(symbol_array[i].children, ContainerChain.add_container(container_chain, symbol.get_container_specifier()));
                    }
                }

                parse_symbol_iteration(root_symbols, "");
                resolve({declarations: declaration_symbols, definitions: definition_symbols});
            }
        );
    }
};



function symbols_for(uri){
	return vscode.commands.executeCommand("vscode.executeDocumentSymbolProvider", uri);
}


function filter_unique_header_symbols(header_symbols, source_symbols){
    const unique_header_symbols = [];
    for(let i=0; i!=header_symbols.length; ++i){
        let unique = true;
        for(let j=0; j!=source_symbols.length; ++j){
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


function update_symbol_index_from(header_uri, source_uri){
    console.log("update symbol index for: " + header_uri.toString());

    return new Promise(
        function(resolve, reject){
            vscode.workspace.openTextDocument(source_uri).then(
                function(source_document){
                    vscode.workspace.openTextDocument(header_uri).then(
                        function(header_document){
                            symbols_for(header_uri).then(
                                function(header_symbols){
                                    if(header_symbols === undefined){
                                        header_symbols = [];
                                    }
        
                                    symbols_for(source_uri).then(
                                        function(source_symbols){
                                            if(source_symbols === undefined){
                                                source_symbols = [];
                                            }
        
                                            SymbolParser.parse_symbols(header_document, header_symbols).then(
                                                function(parsed_header_symbols){
                                                    SymbolParser.parse_symbols(source_document, source_symbols).then(
                                                        function(parsed_source_symbols){
                                                            // make diff
                                                            console.log("results: ");
                                                            console.log(parsed_header_symbols.declarations);
                                                            console.log(parsed_source_symbols.definitions);
                                                            const unique_symbols = filter_unique_header_symbols(parsed_header_symbols.declarations, parsed_source_symbols.definitions);
                                                            console.log(unique_symbols);
                                                            symbol_index[source_uri.toString()] = unique_symbols;
                                                            console.log("updated symbol index!");
                                                            resolve(unique_symbols);
                                                        }
                                                    )
                                                }
                                            );
                                        }
                                    );
                                }
                            );
                        }
                    )
                }
            );
        }
    );
}


function update_symbol_index(document){
	const uri = document.uri;

    return new Promise(
        function(resolve, reject){
            FilePairFactory.create_file_pair_from_uri(uri).then(
                function(file_pair){
                    update_symbol_index_from(file_pair.header_uri, file_pair.source_uri).then(
                        function(symbols){
                            resolve(symbols);
                        }
                    );
                }
            );
        }
    );
}


module.exports = {
    MethodSymbol,
	update_symbol_index,
	symbols_for,
    symbol_index
}