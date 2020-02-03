const SigaaBase = require('./sigaa-base')
const SigaaTypes = require('./sigaa-types')
const SigaaErrors = require('./sigaa-errors')
const Cheerio = require('cheerio')

/**
 * @class SigaaLogin
 */
class SigaaLogin extends SigaaBase {
  /**
   * Get page of login
   * @async
   * @returns {Promise<http.ClientRequest>}
   * @
   */
  _getLoginPage() {
    this._loginPage = this._get('/sigaa/mobile/touch/login.jsf', {
      noCache: true
    })
      .then((page) => {
        if (page.statusCode === 200) {
          return page
        } else {
          throw new Error(SigaaErrors.SIGAA_UNEXPECTED_RESPONSE)
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

  /**
   * @async
   * @returns {Promise<Boolean>}
   */
  async cacheLoginForm() {
    return this._loadLoginForm()
  }

  async _loadLoginForm(retry = true) {
    if (!this._loginPage) {
      await this._getLoginPage()
    }
    const page = await this._loginPage
    if (page.statusCode) {
      if (page.statusCode !== 200) {
        if (retry) {
          return this._loadLoginForm(false)
        } else {
          throw new Error(SigaaErrors.SIGAA_UNEXPECTED_RESPONSE)
        }
      } else {
        const $ = Cheerio.load(page.body, {
          normalizeWhitespace: true
        })
        const formElement = $('#form-login')
        const action = new URL(
          formElement.attr('action'),
          this._sigaaSession.url
        ).href
        const postValues = {}
        formElement.find('input').each(function() {
          postValues[$(this).attr('name')] = $(this).val()
        })
        const postValuesKeys = Object.keys(postValues)
        const usernameFormIndex = 1
        const passwordFormIndex = 2
        postValues[postValuesKeys[usernameFormIndex]] = ''
        postValues[postValuesKeys[passwordFormIndex]] = ''
        this._sigaaSession.formLoginAction = action
        this._sigaaSession.formLoginPostValues = postValues
        this._loginPage = null
      }
    } else {
      throw page
    }
  }

  async login(username, password, retry = true) {
    if (
      this._sigaaSession.formLoginAction === null ||
      this._sigaaSession.formLoginPostValues === null
    ) {
      await this._loadLoginForm()
    }
    const postValuesKeys = Object.keys(this._sigaaSession.formLoginPostValues)
    const usernameFormIndex = 1
    const passwordFormIndex = 2
    this._sigaaSession.formLoginPostValues[
      postValuesKeys[usernameFormIndex]
    ] = username
    this._sigaaSession.formLoginPostValues[
      postValuesKeys[passwordFormIndex]
    ] = password
    const formLoginAction = this._sigaaSession.formLoginAction
    const formLoginPostValues = this._sigaaSession.formLoginPostValues
    this._sigaaSession.formLoginAction = null
    this._sigaaSession.formLoginPostValues = null
    try {
      const page = await this._post(formLoginAction, formLoginPostValues)
      return await this._extractLogin(page)
    } catch (error) {
      if (!retry || error.message === SigaaErrors.SIGAA_WRONG_CREDENTIALS) {
        throw error
      } else {
        return this.login(username, password, false)
      }
    }
  }

  async _extractLogin(page) {
    if (page.statusCode === 200) {
      if (page.url.search.includes('?expirada=true')) {
        throw new Error(SigaaErrors.SIGAA_EXPIRED_PAGE)
      } else if (page.body.includes('form-login')) {
        if (page.body.includes('Usu&#225;rio e/ou senha inv&#225;lidos')) {
          this._loginPage = Promise.resolve(page)
          this._loadLoginForm()
          throw new Error(SigaaErrors.SIGAA_WRONG_CREDENTIALS)
        } else {
          throw new Error(SigaaErrors.SIGAA_UNAVAILABLE_LOGIN)
        }
      } else {
        if (page.body.includes('form-portal-discente')) {
          this._sigaaSession.userLoginState =
            SigaaTypes.userLoginStates.AUTHENTICATED
          this._sigaaSession.userType = SigaaTypes.userTypes.STUDENT
          return true
        } else if (page.body.includes('form-portal-docente')) {
          this._sigaaSession.userLoginState =
            SigaaTypes.userLoginStates.AUTHENTICATED
          this._sigaaSession.userType = SigaaTypes.userTypes.TEACHER
          return true
        } else {
          throw new Error(SigaaErrors.SIGAA_UNKNOWN_USER_TYPE)
        }
      }
    } else {
      throw new Error(SigaaErrors.SIGAA_UNEXPECTED_RESPONSE)
    }
  }
}
module.exports = SigaaLogin
