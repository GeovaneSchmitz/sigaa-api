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
        }else{
            this._cache = new SigaaCache()
        }
        this.account = new SigaaAccount(this._cache)
        this.classStudent = new SigaaClassStudent(this._cache)
    }
}

module.exports = Sigaa