

class ContainerChain{
    static add_container(chain, new_container){
        if(new_container != ""){
            chain += new_container + "::";
        }
        return chain;
    }

};





module.exports = {
    ContainerChain
}
