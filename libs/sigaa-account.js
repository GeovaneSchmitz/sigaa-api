const SigaaRequest = require('./sigaa-request')
const { JSDOM } = require('jsdom')
;('use strict')

class SigaaAccount extends SigaaRequest {
  constructor (cache) {
    super(cache)
  }
  login (user, password) {
    let postOptions = {
      width: 1920,
      height: 1080,
      urlRedirect: '',
      subsistemaRedirect: '',
      acao: '',
      acessibilidade: '',
      'user.login': user,
      'user.senha': password
    }
    return this.post('/sigaa/logar.do?dispatch=logOn', postOptions)
      .then(res => {
        return this.followAllRedirect(res)
      })
      .then(res => {
        return new Promise((resolve, reject) => {
          let response = {}
          if (res.statusCode == 200) {
            if (res.url.pathname.includes('logar.do')) {
              response.status = 'ERROR'
              response.errorCode = 'WRONG_CREDENTIALS'
            } else {
              if (res.url.pathname.includes('discente')) {
                response.status = 'LOGGED'
                response.userType = 'STUDENT'
                response.token = res.token
              } else if (res.url.pathname.includes('docente')) {
                response.status = 'LOGGED'
                response.userType = 'TEACHER'
                response.token = res.token
              } else {
                response.status = 'LOGGED'
                response.userType = 'UNKNOWN'
                response.token = res.token
              }
            }
            resolve(response)
          } else {
            response.status = 'ERROR'
            response.errorCode = res.statusCode
            reject(response)
          }
        })
      })
  }

  logoff (token) {
    return this.get('/sigaa/logar.do?dispatch=logOff', token)
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
  setNewPassword (oldPassword, newPassword, token) {
    return this.get('/sigaa/alterar_dados.jsf', token)
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
            let form = this.extractForm(res, 'form', {submitInput:false})
            form.postOptions['form:alterarSenha'] = 'form:alterarSenha'
            resolve(this.post(form.action, form.postOptions, res.token))
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
            let form = this.extractForm(res, 'form', {submitInput:true})
            form.postOptions['form:senhaAtual'] = oldPassword
            form.postOptions['form:novaSenha'] = newPassword
            form.postOptions['form:repetnNovaSenha'] = newPassword
            resolve(this.post(form.action, form.postOptions, res.token))
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
