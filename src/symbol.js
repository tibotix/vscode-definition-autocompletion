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
            case 24:
                return new MethodSymbol(symbol_obj, this.document, container_chain);
            default:
                return new Symbol(symbol_obj, this.document, container_chain);
        }
    }
};



function get_eol(document){
    switch (document.eol) {
        case 1:
            return "\n";
        case 2:
            return "\r\n";
        default:
            return "\r\n";
    }
}

class Symbol {

    static create_signature(symbol_lines, container_chain, identifier_name_start, eol){
        // let signature = "";
        const signature = []
        for(let i=0; i<symbol_lines.length-1; ++i){
            // console.log("adding: > " + symbol_lines[i].trim() + " <");
            signature.push(symbol_lines[i].trim());
        }
        const last_line = symbol_lines[symbol_lines.length-1].trim();
        // console.log("last line: " + last_line);
        // console.log("id_start: " + identifier_name_start);
        signature.push(last_line.slice(0, identifier_name_start) + container_chain + last_line.slice(identifier_name_start, last_line.length-1));
        return signature.join(eol).trim();
    }

    constructor(symbol_obj, document, container_chain){
		// console.log("symbol_obj: ");
		// console.log(symbol_obj);
        const eol = get_eol(document);
        
        this.symbol_text = document.getText(symbol_obj.range);
        this.symbol_lines = this.symbol_text.split(eol);
        //console.log("container chain: " + container_chain);
        //console.log("symbol_text: > " + this.symbol_text + " <");
        //console.log("symbol_lines: ");
        //console.log(this.symbol_lines);
		this.signature = Symbol.create_signature(this.symbol_lines, container_chain, symbol_obj.selectionRange.start.character - symbol_obj.range.start.character, eol);
        // console.log("signature: > " + this.signature + " <");
        this.clear_attributes();
        this.symbol_text = this.symbol_text.trim();
        this.signature = this.signature.trim();

		this.kind = symbol_obj.kind;
        this.name = symbol_obj.name;
		this.full_name = container_chain + symbol_obj.name;
	}

    clear_attributes(){
        this.signature = this.signature.replace(" override", "").replace("virtual ", "").replace("[[nodiscard]] ", "").replace("explicit ", "").replace("static ", "").replace("inline ", "");
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
        return (this.full_name == other.full_name);
    }

    get_insert_text(){
        return " {\n\t$0\n}";
    }

};

class BaseFunctionSymbol extends Symbol{
    constructor(symbol_obj, document, container_chain){
        super(symbol_obj, document, container_chain);
        // TODO: catch header definitions
        this.is_declaration = this.symbol_text.endsWith(";");
		this.is_deleted = this.symbol_text.endsWith("delete;");
		this.is_defaulted = this.symbol_text.endsWith("default;");
        this.is_pure_virtual = this.symbol_text.endsWith("0;");
    }

	is_symbol_with_no_definition(){
        return (this.is_declaration && !this.is_defaulted && !this.is_deleted && !this.is_pure_virtual);
	}
}

class FunctionSymbol extends BaseFunctionSymbol{ // without class
    constructor(symbol_obj, document, container_chain){
        super(symbol_obj, document, container_chain);
    }
};

class MethodSymbol extends BaseFunctionSymbol{ // with class
    constructor(symbol_obj, document, container_chain){
        super(symbol_obj, document, container_chain);
        this.is_constructor_symbol = this.is_constructor();
    }

    is_constructor(){
        const sig_split = this.signature.split("::");
        if(sig_split.length > 1 && sig_split[sig_split.length-2] == sig_split[sig_split.length-1].substring(0, sig_split[sig_split.length-1].indexOf("("))){
            return true;
        }
        return false;
    }

    get_insert_text(){
        if(this.is_constructor_symbol){
            return " : ${1:m_var}(${2:param}) \n{$0}";
        }
        return super.get_insert_text();
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
    // console.log("update symbol index for: " + header_uri.toString());

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

                                    // console.log(header_symbols);
        
                                    symbols_for(source_uri).then(
                                        function(source_symbols){
                                            if(source_symbols === undefined){
                                                source_symbols = [];
                                            }

                                            // console.log(source_symbols);
        
                                            SymbolParser.parse_symbols(header_document, header_symbols).then(
                                                function(parsed_header_symbols){
                                                    SymbolParser.parse_symbols(source_document, source_symbols).then(
                                                        function(parsed_source_symbols){
                                                            // make diff
                                                            // console.log("results: ");
                                                            // console.log(parsed_header_symbols.declarations);
                                                            // console.log(parsed_source_symbols.definitions);
                                                            const unique_symbols = filter_unique_header_symbols(parsed_header_symbols.declarations, parsed_source_symbols.definitions);
                                                            // console.log(unique_symbols);
                                                            symbol_index[source_uri.toString()] = unique_symbols;
                                                            // console.log("updated symbol index!");
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
                    // console.log(file_pair);
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