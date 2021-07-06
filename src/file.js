const { glob } = require('glob');
const vscode = require('vscode');


var header_files = new Object(); // to cache already found header files and their associated source files
var source_files = new Object(); // to cache already found source files and their associated header files


async function is_header_file(uri){
	return await uri.path.match(".*(h$|hpp$)");
}

async function is_source_file(uri){
	return await uri.path.match(".*(c$|cpp$)");
}

class FileFinder{
    constructor(){
        this.file_name = "";
        this.base = "";
        this.max_results = 1;
        this.extensions = [];
    }

    async match_base(){
        this.base = "**/";
        return this;
    }

    async match_extensions(ext){
        this.extensions = this.extensions.concat(ext);
        return this;
    }

    async match_file_name(file_name){
        this.file_name = file_name;
        return this;
    };
    
    async max(n){
        this.max_results = n;
        return this;
    }

    async generate_include_pattern(){
        var include_pattern = this.base + this.file_name + ".{"
        for(let i=0; i!=this.extensions.length; ++i){
            include_pattern += this.extensions[i]+ ",";
        }
        include_pattern += "}";
        return include_pattern;
    }

    async find_files(){
        var include_pattern = await this.generate_include_pattern();
        console.log("include_pattern: " + include_pattern);

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
		return vscode.workspace.findFiles(include_pattern, "", this.max_results);
    }


};

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
		await (await (await (await new FileFinder().match_base()).match_file_name(header_file.file_name)).match_extensions(["c", "cpp"])).find_files().then(
            async function(source_uri_array){
                console.log("Found SourceFile: " + source_uri_array[0].toString());
                header_file.source_file = await SourceFile.get(source_uri_array[0], this);
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
};


module.exports = {
	is_header_file,
	is_source_file,
    SourceFile,
    HeaderFile,
    FileFinder
}