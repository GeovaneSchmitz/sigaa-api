const { JSDOM } = require('jsdom')

const SigaaBase = require('./sigaa-base')

class SigaaAccount extends SigaaBase {
  logoff () {
    return this._get('/sigaa/logar.do?dispatch=logOff')
      .then(res => {
        return this.followAllRedirect(res)
      })
      .then(res => {
        if (res.statusCode === 200) {
          this._sigaaSession.finish()
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
    return this._get('/sigaa/alterar_dados.jsf')
      .then(page => {
        return new Promise((resolve, reject) => {
          if (page.statusCode === 302) {
            resolve(page)
          } else if (page.statusCode === 200) {
            reject(new Error('SESSION_EXPIRED'))
          } else {
            reject(new Error(`SIGAA_STATUSCODE_${page.statusCode}`))
          }
        })
      })
      .then(page => {
        return this.followAllRedirect(page)
      })
      .then(page => {
        return new Promise((resolve, reject) => {
          if (
            page.statusCode === 200 &&
            page.url.href.includes('usuario/alterar_dados.jsf')
          ) {
            const { document } = new JSDOM(page.body).window
            const formEl = document.forms['form']
            const form = this._extractForm(formEl, { submitInput: false })
            form.postOptions['form:alterarSenha'] = 'form:alterarSenha'
            resolve(this._post(form.action, form.postOptions))
          } else {
            reject(new Error(page.statusCode))
          }
        })
      })
      .then(page => {
        return new Promise((resolve, reject) => {
          if (page.statusCode === 200) {
            const { document } = new JSDOM(page.body).window
            const formEl = document.forms['form']
            const form = this._extractForm(formEl, { submitInput: true })
            form.postOptions['form:senhaAtual'] = oldPassword
            form.postOptions['form:novaSenha'] = newPassword
            form.postOptions['form:repetnNovaSenha'] = newPassword
            resolve(this._post(form.action, form.postOptions))
          } else {
            reject(new Error(`SIGAA_STATUSCODE_${page.statusCode}`))
          }
        })
      })
      .then(page => {
        return new Promise((resolve, reject) => {
          if (page.statusCode === 200) {
            const { document } = new JSDOM(page.body).window
            const errorMsg = document.querySelector('.erros li').innerHTML
            const response = {
              status: 'ERROR',
              errorCode: 'UNKNOWN',
              errorMsg
            }
            if (errorMsg.includes('A senha digitada é muito simples.')) {
              response.errorCode = 'INSUFFICIENT_PASSWORD_COMPLEXITY'
            } else if (errorMsg.includes('Senha Atual digitada não confere')) {
              response.errorCode = 'WRONG_PASSWORD'
            }
            reject(response)
          } else if (page.statusCode === 302) {
            resolve({
              status: 'SUCCESS'
            })
          }
        })
      })
  }
}

module.exports = SigaaAccount
