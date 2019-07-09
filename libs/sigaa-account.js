const { JSDOM } = require('jsdom')


const SigaaBase = require('./sigaa-base')
const SigaaClassStudent = require('./sigaa-class-student')

'use strict'

class SigaaAccount extends SigaaBase {
  constructor (sigaaData) {
    super(sigaaData)
  }
  get token(){
    return this._data.token
  }
  
  logoff () {
    return this._get('/sigaa/logar.do?dispatch=logOff', this._data.token)
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
    return this._get('/sigaa/alterar_dados.jsf', this._data.token)
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
