const SigaaAccount = require('./libs/common/sigaa-account')
const SigaaAccountStudent = require('./libs/student/sigaa-account-student')
const SigaaLogin = require('./libs/common/sigaa-login')
const SigaaSession = require('./libs/common/sigaa-session')

class Sigaa {
  constructor (params) {
    if (params) {
      if (params.url) {
        this._sigaaSession = new SigaaSession()
        this._sigaaSession.url = params.url
        this._sigaaLogin = new SigaaLogin(this._sigaaSession)
      } else {
        throw new Error('SIGAA_URL_IS_NECESSARY')
      }
    } else {
      throw new Error('SIGAA_OPTIONS_IS_NECESSARY')
    }
  }

  login (username, password) {
    return this._sigaaLogin.login(username, password)
      .then(() => new Promise((resolve, reject) => {
        if (this._sigaaSession.userType === 'STUDENT') {
          resolve(new SigaaAccountStudent(this._sigaaSession))
        } else {
          resolve(new SigaaAccount(this._sigaaSession))
        }
      }))
  }
}

module.exports = Sigaa
