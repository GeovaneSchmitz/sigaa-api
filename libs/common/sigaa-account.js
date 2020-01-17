const Cheerio = require('cheerio')

const SigaaBase = require('./sigaa-base')
const sigaaErrors = require('./sigaa-errors')
/**
 * Account Class
 * @class SigaaAccount
 * @extends SigaaBase
 */
class SigaaAccount extends SigaaBase {
  /**
   * Makes logoff
   * @returns {Boolean} true
   * @async
   * @throws {SIGAA_UNEXPECTED_RESPONSE}
   */
  logoff() {
    return this._get('/sigaa/logar.do?dispatch=logOff')
      .then((page) => {
        return this.followAllRedirect(page)
      })
      .then((page) => {
        if (page.statusCode === 200) {
          this._sigaaSession.finish()
          return true
        } else {
          throw new Error(sigaaErrors.SIGAA_UNEXPECTED_RESPONSE)
        }
      })
  }

  /**
   * Save the account/session in object JSON
   * @returns {Object}
   */
  toJSON() {
    return this._sigaaSession.toJSON()
  }

  get status() {
    return this._sigaaSession.status
  }

  get userType() {
    return this._sigaaSession.userType
  }

  /**
   * Change the password of account
   * @async
   * @param {String} oldPassword current Password
   * @param {String} newPassword new password
   * @throws {SIGAA_UNEXPECTED_RESPONSE}
   * @throws {SIGAA_EXPIRED_PAGE}
   * @throws {SIGAA_WRONG_CREDENTIALS} If current password is not correct
   * @throws {INSUFFICIENT_PASSWORD_COMPLEXITY} If the new password does not have the complexity requirement
   */
  changePassword(oldPassword, newPassword) {
    return this._get('/sigaa/alterar_dados.jsf')
      .then((page) => {
        return new Promise((resolve, reject) => {
          if (page.statusCode === 302) {
            resolve(page)
          } else if (page.statusCode === 200) {
            reject(new Error(sigaaErrors.SIGAA_EXPIRED_PAGE))
          } else {
            reject(new Error(sigaaErrors.SIGAA_UNEXPECTED_RESPONSE))
          }
        })
      })
      .then((page) => {
        return this.followAllRedirect(page)
      })
      .then((page) => {
        return new Promise((resolve, reject) => {
          if (
            page.statusCode === 200 &&
            page.url.href.includes('usuario/alterar_dados.jsf')
          ) {
            const $ = Cheerio.load(page.body)
            const formElement = $('form[name="form"]')
            const action = new URL(formElement.attr('action'), page.url.href)
              .href
            const postValues = {}

            const inputs = formElement
              .find("input[name]:not([type='submit'])")
              .toArray()
            for (const input of inputs) {
              postValues[$(input).attr('name')] = $(input).val()
            }
            postValues['form:alterarSenha'] = 'form:alterarSenha'
            resolve(this._post(action, postValues))
          } else {
            reject(new Error(page.statusCode))
          }
        })
      })
      .then((page) => {
        return new Promise((resolve, reject) => {
          const $ = Cheerio.load(page.body)
          const formElement = $('form[name="form"]')
          const formAction = new URL(formElement.attr('action'), page.url.href)
            .href
          const postValues = {}
          const inputs = formElement
            .find("input[name]:not([type='submit'])")
            .toArray()
          for (const input of inputs) {
            postValues[$(input).attr('name')] = $(input).val()
          }
          postValues['form:senhaAtual'] = oldPassword
          postValues['form:novaSenha'] = newPassword
          postValues['form:repetnNovaSenha'] = newPassword
          postValues['form:alterarDados'] = 'Alterar Dados'
          resolve(this._post(formAction, postValues))
        })
      })
      .then((page) => {
        return new Promise((resolve, reject) => {
          if (page.statusCode === 200) {
            const $ = Cheerio.load(page.body, {
              normalizeWhitespace: true
            })
            const errorMsg = this._removeTagsHtml($('.erros li').html())
            if (errorMsg.includes('A senha digitada é muito simples.')) {
              reject(new Error(sigaaErrors.INSUFFICIENT_PASSWORD_COMPLEXITY))
            } else if (errorMsg.includes('Senha Atual digitada não confere')) {
              reject(new Error(sigaaErrors.SIGAA_WRONG_CREDENTIALS))
            }
          } else if (page.statusCode === 302) {
            resolve(true)
          }
        })
      })
  }
}
module.exports = SigaaAccount
