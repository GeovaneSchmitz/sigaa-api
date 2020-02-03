const SigaaAccount = require('./libs/common/sigaa-account')
const SigaaAccountStudent = require('./libs/student/sigaa-account-student')
const SigaaLogin = require('./libs/common/sigaa-login')
const SigaaSession = require('./libs/common/sigaa-session')
const SigaaErrors = require('./libs/common/sigaa-errors')
const SigaaSearch = require('./libs/public/sigaa-search')
const SigaaTypes = require('./libs/common/sigaa-types')
/**
 * @class Sigaa
 */
class Sigaa {
  constructor(params) {
    if (params) {
      if (params.sessionJSON) {
        this._sigaaSession = new SigaaSession()
        this._sigaaSession.parseJSON(params.sessionJSON)
        this._sigaaLogin = new SigaaLogin(this._sigaaSession)
      } else if (params.url) {
        this._sigaaSession = new SigaaSession()
        this._sigaaLogin = new SigaaLogin(this._sigaaSession)
        this._sigaaSession.url = params.url
      } else {
        throw new Error('SIGAA_URL_IS_NECESSARY')
      }
    } else {
      throw new Error('SIGAA_OPTIONS_IS_NECESSARY')
    }
  }

  cacheLoginForm() {
    return this._sigaaLogin.cacheLoginForm()
  }

  toJSON() {
    return this._sigaaSession.toJSON()
  }

  /**
   * User authentication
   * @param {String} username
   * @param {String} password
   * @async
   * @returns {Promise<SigaaAccountStudent>}
   */
  async login(username, password) {
    if (
      this._sigaaSession.userLoginState !==
      SigaaTypes.userLoginStates.AUTHENTICATED
    ) {
      await this._sigaaLogin.login(username, password)
    } else {
      throw new Error(SigaaErrors.SIGAA_ALREADY_LOGGED_IN)
    }
    return this.account
  }

  get account() {
    if (
      this._sigaaSession.userLoginState ===
      SigaaTypes.userLoginStates.AUTHENTICATED
    ) {
      if (this._sigaaSession.userType === SigaaTypes.userTypes.STUDENT) {
        return new SigaaAccountStudent(this._sigaaSession)
      } else {
        return new SigaaAccount(this._sigaaSession)
      }
    }
    return null
  }

  get search() {
    return new SigaaSearch(this._sigaaSession)
  }
}
/**
 * Enum with all errors
 * @enum {String} Errors
 * @readonly
 */
Sigaa.errors = SigaaErrors

/**
 * Enum with types
 * @enum {Object} Types
 * @readonly
 */
Sigaa.types = SigaaTypes
module.exports = Sigaa
