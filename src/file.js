const { glob } = require('glob');
const vscode = require('vscode');

var file_pairs = new Object();

function is_header_file(uri){
	return uri.path.match(".*(h$|hpp$)");
}

function is_source_file(uri){
	return uri.path.match(".*(c$|cpp$)");
}

class FileFinder{
    constructor(){
        this.file_name = "";
        this.base = "";
        this.max_results = 1;
        this.extensions = [];
    }

    match_base(){
        this.base = "**/";
        return this;
    }

    match_extensions(ext){
        this.extensions = this.extensions.concat(ext);
        return this;
    }

    match_file_name(file_name){
        this.file_name = file_name;
        return this;
    };
    
    max(n){
        this.max_results = n;
        return this;
    }

    generate_include_pattern(){
        var include_pattern = this.base + this.file_name + ".{"
        for(let i=0; i!=this.extensions.length; ++i){
            include_pattern += this.extensions[i]+ ",";
        }
        include_pattern += "}";
        return include_pattern;
    }

    find_files(){
        var include_pattern = this.generate_include_pattern();
		const max_results = this.max_results;

		return new Promise(
			function(resolve, reject){
				if(vscode.workspace.name === undefined){
					glob(include_pattern, { matchBase: true}, function(err, files){
						// console.log(files);
						if(err){
							reject("");
						} else {
							resolve(files.map(function(path){return vscode.Uri.file(path);}));
						}
					});
				} else {
					vscode.workspace.findFiles(include_pattern, "", max_results).then(
						function(file_uris){
							resolve(file_uris);
						}
					);
				}

			}
		);
    }
};

class FilePair {
	constructor(header_uri, source_uri){
		this.header_uri = header_uri;
		this.source_uri = source_uri;
	}
};

class FilePairFactory {
	static create_file_pair_from_uri(uri){
		let header_uri = null;
		let source_uri = null;
		const beginning = uri.path.substring(0, uri.path.lastIndexOf("."));
		const file_name = uri.path.substring(uri.path.lastIndexOf("/")+1, uri.path.lastIndexOf("."));

		return new Promise(
			function(resolve, reject){
				if(file_pairs.hasOwnProperty(beginning)){
					console.log("returning cached file pair");
					resolve(file_pairs[beginning]);
				}
		
				new FileFinder().match_base().match_file_name(file_name).match_extensions(["h", "hpp"]).find_files().then(
					function(header_uri_array){
						if(header_uri_array.length){
							header_uri = header_uri_array[0];
						}
						new FileFinder().match_base().match_file_name(file_name).match_extensions(["c", "cpp"]).find_files().then(
							function(source_uri_array){
								if(source_uri_array.length){
									source_uri = source_uri_array[0];
								}
								const pair = new FilePair(header_uri, source_uri);
								file_pairs[beginning] = pair;
								resolve(pair);
							}
						);
					}
				);
			}
		);
	}
};




module.exports = {
	is_header_file,
	is_source_file,
	FilePair,
    FilePairFactory,
    FileFinder
}