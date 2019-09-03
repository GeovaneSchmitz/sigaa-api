const SigaaBase = require('./sigaa-base')
const cheerio = require('cheerio')

class SigaaLogin extends SigaaBase {
  constructor (sigaaSession) {
    super(sigaaSession)
    this._loginPage = this._loadLoginPage()
  }

  _loadLoginPage () {
    return this._get('/sigaa/mobile/touch/public/principal.jsf')
      .then(page => {
        if (page.statusCode === 200) {
          const $ = cheerio.load(page.body, {
            normalizeWhitespace: true
          })
          const buttonPageLogin = $('#form-lista-public-index\\:acessar')
          const form = this._extractJSFCLJS(buttonPageLogin.attr('onclick'), page.body)
          return this._post(form.action, form.postOptions)
        } else {
          throw new Error(`SIGAA_STATUSCODE_${page.statusCode}`)
        }
      }).catch(err => new Promise(resolve => resolve(err)))
  }

  login (username, password, retry = true) {
    return this._loginPage.then(page => {
      if (page.statusCode) {
        if (page.statusCode !== 200) {
          if (retry) {
            return this.login(username, password, false)
          } else {
            throw new Error(`SIGAA_STATUSCODE_${page.statusCode}`)
          }
        } else {
          const $ = cheerio.load(page.body, {
            normalizeWhitespace: true
          })
          const formElement = $('#form-login')
          const action = new URL(formElement.attr('action'), this._sigaaSession.url).href
          const postOptions = {}
          formElement.find('input').each(function () {
            postOptions[$(this).attr('name')] = $(this).val()
          })
          const postOptionsKeys = Object.keys(postOptions)
          postOptions[postOptionsKeys[1]] = username
          postOptions[postOptionsKeys[2]] = password
          return this._post(action, postOptions)
            .then(page => this._extractLogin(page))
        }
      } else {
        throw page
      }
    })
  }

  _extractLogin (page) {
    return new Promise((resolve, reject) => {
      if (!page) throw new Error('PAGE_ERROR', page)
      if (page.statusCode === 200) {
        if (page.url.search.includes('?expirada=true')) {
          reject(new Error('SIGAA_EXPIRED_PAGE'))
        } else if (page.body.includes('form-login')) {
          this._loginPage = page
          reject(new Error('WRONG_CREDENTIALS'))
        } else {
          if (page.body.includes('form-portal-discente')) {
            this._sigaaSession.status = 'LOGGED'
            this._sigaaSession.userType = 'STUDENT'
            resolve(true)
          } else if (page.body.includes('form-portal-docente')) {
            this._sigaaSession.status = 'LOGGED'
            this._sigaaSession.userType = 'TEACHER'
            resolve(true)
          } else {
            reject(new Error('UNKNOWN_USER_TYPE'))
          }
        }
      } else {
        reject(new Error(`SIGAA_STATUSCODE_${page.statusCode}`))
      }
    })
  }
}
module.exports = SigaaLogin
