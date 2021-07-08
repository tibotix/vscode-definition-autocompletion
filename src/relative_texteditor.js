



class RelativeTextEditor {
    constructor(text, relative_start_position, eol){
        this.text = text;
        this.relative_start_position = relative_start_position;
        this.eol = eol;
        this.lines = text.split(eol);
    }

    relative_line(line){
        return line - this.relative_start_position.line;
    }

    relative_character(character){
        return character - this.relative_start_position.character;
    }

    insert(position, text_to_insert){
        const line = this.relative_line(position.line);
        const character = this.relative_character(position.character);
        const text = this.lines[line];
        const new_text = text.substring(0, character) + text_to_insert + text.substring(character);
        this.lines[line] = new_text;
    }

    get_text(){
        return this.lines.join(this.eol);
    }
};


module.exports = {
    RelativeTextEditor
}