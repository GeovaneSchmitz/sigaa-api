const { JSDOM } = require('jsdom')


const SigaaBase = require('./sigaa-base')
const SigaaClassStudent = require('./sigaa-class-student')

'use strict'

class SigaaAccount extends SigaaBase {
  constructor (username, password, options) {
    super(options.urlBase, options.cache)
    return this._login(username, password) 
  }


  getClasses() {
    return new Promise((resolve, reject) => {
      if(this._userType !== "STUDENT"){
        reject("USER_IS_NOT_A_STUDENT")
      }
      if(this._status !== 'LOGGED'){
        reject("USER_IS_NOT_LOGGED")
      }
      resolve()
    }).then(() => {
      return this._get(
        '/sigaa/portais/discente/discente.jsf',
        this._token)
    }).then(res => {
      return new Promise((resolve, reject) => {
        if (res.statusCode == 200) {
          let { document } = new JSDOM(res.body).window;
          let tbodyClasses = document
            .querySelector('div#turmas-portal.simple-panel')
            .querySelector("table[style='margin-top: 1%;']")
            .querySelector('tbody');
          let trsClasses = tbodyClasses.querySelectorAll(
            "tr[class=''], tr.odd"
          );
          let list = [];
          for (var i = 0; i < trsClasses.length; i++) {
            let tds = trsClasses[i].querySelectorAll('td');
            let name = tds[0].querySelector('a').innerHTML;
            let id = tds[0].querySelector("input[name='idTurma']").value;
            let location = tds[1].innerHTML;
            let schedule = tds[2].firstChild.innerHTML.replace(/\t|\n/g, '');
            
            list.push(new SigaaClassStudent({
              name,
              id,
              location,
              schedule,
            }, {
              token: this._token,
              urlBase: this._urlBase,
              cache: this._cache
            }));
          }
          resolve(list);
        } else if (res.statusCode == 302) {
          reject({
            status: 'ERROR',
            errorCode: 'INVALID_TOKEN',
          });
        } else {
          reject({
            status: 'ERROR',
            errorCode: res.statusCode,
          });
        }
      });
    });
  }
  _login (username, password) {
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

    return this._post('/sigaa/logar.do?dispatch=logOn', postOptions)
      .then(res => {
        return this.followAllRedirect(res)
      })
      .then(res => {
        return new Promise((resolve, reject) => {
          if (res.statusCode == 200) {
            if (res.url.pathname.includes('logar.do')) {
              reject({ 
                status:'ERROR',
                errorCode: 'WRONG_CREDENTIALS'
              })
            } else {
              if (res.url.pathname.includes('discente')) {
                this._status = 'LOGGED'
                this._userType = 'STUDENT'
              } else if (res.url.pathname.includes('docente')) {
                this._status = 'LOGGED'
                this._userType = 'TEACHER'
              } else {
                this._status = 'LOGGED'
                this._userType = 'UNKNOWN'
              }
              this._token = res.token
              resolve(this)

            }
            resolve(this)
          } else {
            reject({
              status:'ERROR',
              errorCode:res.statusCode
            })
          }
        })
      })
  }

  logoff () {
    return this._get('/sigaa/logar.do?dispatch=logOff', this._token)
      .then(res => {
        return this.followAllRedirect(res)
      })
      .then(res => {
        if (res.statusCode == 200) {
          return {
            status: 'UNLOGGED'
          }
        } else {
          return {
            status: 'ERROR',
            errorCode: res.statusCode
          }
        }
      })
  }
  setNewPassword (oldPassword, newPassword) {
    return this._get('/sigaa/alterar_dados.jsf', this._token)
      .then(res => {
        return new Promise((resolve, reject) => {
          if (res.statusCode == 302) {
            resolve(res)
          } else if (res.statusCode == 200) {
            reject({
              status: 'ERROR',
              errorCode: 'INVALID_TOKEN'
            })
          } else {
            reject({
              status: 'ERROR',
              errorCode: res.statusCode
            })
          }
        })
      })
      .then(res => {
        return this.followAllRedirect(res)
      })
      .then(res => {
        return new Promise((resolve, reject) => {
          if (
            res.statusCode == 200 &&
            res.url.href.includes('usuario/alterar_dados.jsf')
          ) {
            let {document} = new JSDOM (res.body).window;
            let formEl = document.forms['form']
            let form = this._extractForm(formEl, {submitInput:false})
            form.postOptions['form:alterarSenha'] = 'form:alterarSenha'
            resolve(this._post(form.action, form.postOptions, res.token))
          } else {
            reject({
              status: 'ERROR',
              errorCode: res.statusCode
            })
          }
        })
      })
      .then(res => {
        return new Promise((resolve, reject) => {
          if (res.statusCode == 200) {
            let {document} = new JSDOM (res.body).window;
            let formEl = document.forms['form']
            let form = this._extractForm(formEl, {submitInput:true})
            form.postOptions['form:senhaAtual'] = oldPassword
            form.postOptions['form:novaSenha'] = newPassword
            form.postOptions['form:repetnNovaSenha'] = newPassword
            resolve(this._post(form.action, form.postOptions, res.token))
          } else {
            reject({
              status: 'ERROR',
              errorCode: res.statusCode
            })
          }
        })
      })
      .then(res => {
        return new Promise((resolve, reject) => {
          if (res.statusCode == 200) {
            let { document } = new JSDOM(res.body).window
            let errorMsg= document.querySelector(".erros li").innerHTML;
            let response = {
              status: 'ERROR',
              errorCode: 'UNKNOWN',
              errorMsg
            }
            if(errorMsg.includes("A senha digitada é muito simples.")){
              response.errorCode = "INSUFFICIENT_PASSWORD_COMPLEXITY"
            }else if(errorMsg.includes("Senha Atual digitada não confere")){
              response.errorCode = "WRONG_PASSWORD"
            }
            reject(response)
          }else if(res.statusCode == 302){
            resolve ({
              status: 'SUCCESS'
            })
          }
        })
      })
  }
  
}

module.exports = SigaaAccount
