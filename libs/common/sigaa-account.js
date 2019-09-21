const cheerio = require('cheerio')

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

  toJSON () {
    return this._sigaaSession.toJSON()
  }

  finish () {
    return this._sigaaSession.finish()
  }

  get status () {
    return this._sigaaSession.status
  }

  get userType () {
    return this._sigaaSession.userType
  }

  changePassword (oldPassword, newPassword) {
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
            const $ = cheerio.load(page.body)
            const formElement = $('form[name="form"]')
            const action = new URL(formElement.attr('action'), page.url.href).href
            const postOptions = {}

            const inputs = formElement.find("input[name]:not([type='submit'])").toArray()
            for (const input of inputs) {
              postOptions[$(input).attr('name')] = $(input).val()
            }
            postOptions['form:alterarSenha'] = 'form:alterarSenha'
            resolve(this._post(action, postOptions))
          } else {
            reject(new Error(page.statusCode))
          }
        })
      })
      .then(page => {
        return new Promise((resolve, reject) => {
          const $ = cheerio.load(page.body)
          const formElement = $('form[name="form"]')
          const formAction = new URL(formElement.attr('action'), page.url.href).href
          const postOptions = {}
          const inputs = formElement.find("input[name]:not([type='submit'])").toArray()
          for (const input of inputs) {
            postOptions[$(input).attr('name')] = $(input).val()
          }
          postOptions['form:senhaAtual'] = oldPassword
          postOptions['form:novaSenha'] = newPassword
          postOptions['form:repetnNovaSenha'] = newPassword
          postOptions['form:alterarDados'] = 'Alterar Dados'
          resolve(this._post(formAction, postOptions))
        })
      })
      .then(page => {
        return new Promise((resolve, reject) => {
          if (page.statusCode === 200) {
            const $ = cheerio.load(page.body, {
              normalizeWhitespace: true
            })
            const errorMsg = this._removeTagsHtml($('.erros li').html())
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
