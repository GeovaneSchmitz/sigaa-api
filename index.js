const SigaaAccount = require("./libs/sigaa-account")
const SigaaAccountStudent = require("./libs/sigaa-account-student")
const SigaaLogin = require("./libs/sigaa-login")
const SigaaData = require("./libs/sigaa-data")

class Sigaa {
    constructor(params){

        if(params){
            if(params.urlBase){
                this._urlBase = params.urlBase             
            }else{
                throw "SIGAA_URLBASE_IS_NECESSARY"
            }
        }else{
            throw "SIGAA_OPTIONS_IS_NECESSARY"
        }
    }
    
    login(username, password){
        let sigaaData = new SigaaData()
        sigaaData.urlBase = this._urlBase

        let sigaaLogin = new SigaaLogin(sigaaData)

        return sigaaLogin.login(username, password)
        .then(() => new Promise((resolve, reject) => {
            if (sigaaData.userType == 'STUDENT') {
                resolve(new SigaaAccountStudent(sigaaData));
            }
            else {
                resolve(new SigaaAccount(SigaaData));
            }
        }))
    }
    loginWithToken(token){
        let sigaaData = new SigaaData()
        sigaaData.urlBase = this._urlBase

        let sigaaLogin = new SigaaLogin(sigaaData)

        return sigaaLogin.loginWithToken(token)
        .then(new Promise((resolve, reject) => {
            if(sigaaData.userType == 'STUDENT'){
                resolve(new SigaaAccountStudent(sigaaData))
            }else{
                resolve(new SigaaAccount(SigaaData))
            }
        }))
    }

    
}

module.exports = Sigaa