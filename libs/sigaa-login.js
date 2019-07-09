const SigaaBase = require('./sigaa-base')

class SigaaLogin extends SigaaBase {
    constructor(sigaaData) {
        super(sigaaData)
    }
    loginWithToken(token) {
        return this._get("/sigaa/paginaInicial.do", token)
            .then(res => {
                return this.followAllRedirect(res)
            })
            .then(res => {
                return this._extractLogin(res)
            })
    }
    login(username, password) {
        let postOptions = {
            width: 1920,
            height: 1080,
            urlRedirect: '',
            subsistemaRedirect: '',
            acao: '',
            acessibilidade: '',
            'user.login': username,
            'user.senha': password
        }

        return this._post('/sigaa/logar.do?dispatch=logOn', postOptions, this._data.token)
            .then(res => {
                return this.followAllRedirect(res)
            })
            .then(res => {
                return this._extractLogin(res)
            })
    }

    _extractLogin(res) {
        return new Promise((resolve, reject) => {
            if (res.statusCode == 200) {
                if (res.url.pathname.includes('logar.do')) {
                    reject({
                        status: 'ERROR',
                        errorCode: 'WRONG_CREDENTIALS'
                    });
                }
                else {
                    if (res.url.pathname.includes('discente')) {
                        this._data.status = 'LOGGED';
                        this._data.userType = 'STUDENT';
                    }
                    else if (res.url.pathname.includes('docente')) {
                        this._data.status = 'LOGGED';
                        this._data.userType = 'TEACHER';
                    }
                    else {
                        this._data.status = 'LOGGED';
                        this._data.userType = 'UNKNOWN';
                    }
                    this._data.token = res.token;
                    resolve(true);
                }
            }
            else {
                reject({
                    status: 'ERROR',
                    errorCode: res.statusCode
                });
            }
        });
    }

}
module.exports = SigaaLogin