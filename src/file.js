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


module.exports = {
	is_header_file,
	is_source_file,
    SourceFile,
    HeaderFile
}