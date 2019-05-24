const SigaaAccount = require("./libs/sigaa-account")
const SigaaClassStudent = require("./libs/sigaa-class-student")
const SigaaCache = require("./libs/sigaa-cache")

class Sigaa {
    constructor(params){
        if(params){
            if(params.cache === false){
                
            }else{
                this._cache = new SigaaCache()
            }
            if(params.urlBase){
                this.urlBase = params.urlBase
            }else{
                this.urlBase = 'https://sigaa.ifsc.edu.br'
            }
        }else{
            this._cache = new SigaaCache()
            this.urlBase = 'https://sigaa.ifsc.edu.br'
        }
    }
    get urlBase(){
        return this._urlBase
    }
    set urlBase(data){
        if(typeof data === 'string'){
            this._urlBase = data;
        }else{
            throw 'urlBase is not a string'
        }
    }
    login(username, password){
        return new SigaaAccount(username, password, {urlBase:this.urlBase, cache:this._cache})
    }
}

module.exports = Sigaa