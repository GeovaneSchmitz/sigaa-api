const SigaaBase = require('./sigaa-base')
const Cheerio = require('cheerio')

class SigaaLogin extends SigaaBase {
  _loadLoginPage () {
    this._loginPage = this._get('/sigaa/mobile/touch/login.jsf')
      .then(page => {
        if (page.statusCode === 200) {
          return page
        } else {
          throw new Error(`SIGAA_STATUSCODE_${page.statusCode}`)
        }
      })
      .catch((err) => {
        return new Promise((resolve) => {
          resolve(err)
        })
      })
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
        const $ = Cheerio.load(page.body, {
          normalizeWhitespace: true
        })
        const formElement = $('#form-login')
        const action = new URL(formElement.attr('action'), this._sigaaSession.url).href
        const postOptions = {}
        formElement.find('input').each(function () {
          postOptions[$(this).attr('name')] = $(this).val()
        })
        const postOptionsKeys = Object.keys(postOptions)
        const usernameFormIndex = 1
        const passwordFormIndex = 2
        postOptions[postOptionsKeys[usernameFormIndex]] = ''
        postOptions[postOptionsKeys[passwordFormIndex]] = ''
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
    const usernameFormIndex = 1
    const passwordFormIndex = 2
    this._sigaaSession.formLoginPostOptions[postOptionsKeys[usernameFormIndex]] = username
    this._sigaaSession.formLoginPostOptions[postOptionsKeys[passwordFormIndex]] = password
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
          if (page.body.includes('Usu&#225;rio e/ou senha inv&#225;lidos')) {
            reject(new Error('WRONG_CREDENTIALS'))
          } else {
            reject(new Error('SIGAA_UNAVAILABLE_LOGIN'))
          }
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
