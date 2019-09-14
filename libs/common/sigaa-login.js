const SigaaBase = require('./sigaa-base')
const cheerio = require('cheerio')

class SigaaLogin extends SigaaBase {
  _loadLoginPage () {
    this._loginPage = this._get('/sigaa/mobile/touch/public/principal.jsf')
      .then(page => {
        if (page.statusCode === 200) {
          const $ = cheerio.load(page.body)
          const buttonPageLogin = $('#form-lista-public-index\\:acessar')
          const form = this._extractJSFCLJS(buttonPageLogin.attr('onclick'), $)
          return this._post(form.action, form.postOptions).then(page => {
            return page
          })
        } else {
          throw new Error(`SIGAA_STATUSCODE_${page.statusCode}`)
        }
      }).catch(err => new Promise(resolve => resolve(err)))
    return this._loginPage.then(() => {
      return true
    })
  }

  async cacheLoginForm () {
    return this._extractLoginForm()
  }

  async _extractLoginForm (retry = true) {
    if (!this._loginPage) {
      await this._loadLoginPage()
    }
    const page = await this._loginPage
    if (page.statusCode) {
      if (page.statusCode !== 200) {
        if (retry) {
          return this._extractLoginForm(false)
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
        this._sigaaSession.formLoginAction = action
        this._sigaaSession.formLoginPostOptions = postOptions
      }
    } else {
      throw page
    }
  }

  async login (username, password) {
    if (this._sigaaSession.formLoginAction === undefined || this._sigaaSession.formLoginPostOptions === undefined) {
      await this._extractLoginForm()
    }
    const postOptionsKeys = Object.keys(this._sigaaSession.formLoginPostOptions)
    this._sigaaSession.formLoginPostOptions[postOptionsKeys[1]] = username
    this._sigaaSession.formLoginPostOptions[postOptionsKeys[2]] = password
    return this._post(this._sigaaSession.formLoginAction, this._sigaaSession.formLoginPostOptions)
      .then(page => this._extractLogin(page))
  }

  _extractLogin (page) {
    return new Promise((resolve, reject) => {
      if (!page) throw new Error('PAGE_ERROR', page)
      if (page.statusCode === 200) {
        if (page.url.search.includes('?expirada=true')) {
          reject(new Error('SIGAA_EXPIRED_PAGE'))
        } else if (page.body.includes('form-login')) {
          this._loginPage = new Promise((resolve) => resolve(page))
          this._extractLoginForm()
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
