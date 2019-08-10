const SigaaAccount = require('./libs/common/sigaa-account')
const SigaaAccountStudent = require('./libs/student/sigaa-account-student')
const SigaaLogin = require('./libs/common/sigaa-login')
const SigaaSession = require('./libs/common/sigaa-session')

class Sigaa {
  constructor (params) {
    if (params) {
      if (params.urlBase) {
        this._urlBase = params.urlBase
      } else {
        throw new Error('SIGAA_URLBASE_IS_NECESSARY')
      }
    } else {
      throw new Error('SIGAA_OPTIONS_IS_NECESSARY')
    }
  }

  login (username, password) {
    const sigaaSession = new SigaaSession()
    sigaaSession.urlBase = this._urlBase

    const sigaaLogin = new SigaaLogin(sigaaSession)

    return sigaaLogin.login(username, password)
      .then(() => new Promise((resolve, reject) => {
        if (sigaaSession.userType === 'STUDENT') {
          resolve(new SigaaAccountStudent(sigaaSession))
        } else {
          resolve(new SigaaAccount(SigaaSession))
        }
      }))
  }
}

module.exports = Sigaa
