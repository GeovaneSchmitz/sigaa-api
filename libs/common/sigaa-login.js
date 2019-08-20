const SigaaBase = require('./sigaa-base')

class SigaaLogin extends SigaaBase {
  async login (username, password) {
    const postOptions = {
      width: 1920,
      height: 1080,
      urlRedirect: '',
      subsistemaRedirect: '',
      acao: '',
      acessibilidade: '',
      'user.login': username,
      'user.senha': password
    }
    await this._get('/sigaa/public/home.jsf')
    return this._post('/sigaa/logar.do?dispatch=logOn', postOptions)
      .then(page => this.followAllRedirect(page))
      .then(page => this._extractLogin(page))
  }

  _extractLogin (page) {
    return new Promise((resolve, reject) => {
      if (page.statusCode === 200) {
        if (page.url.pathname.includes('/sigaa/expirada.jsp')) {
          reject(new Error('SIGAA_EXPIRED_PAGE'))
        } else if (page.url.pathname.includes('logar.do')) {
          reject(new Error('WRONG_CREDENTIALS'))
        } else {
          if (page.url.pathname.includes('discente')) {
            this._sigaaSession.status = 'LOGGED'
            this._sigaaSession.userType = 'STUDENT'
          } else if (page.url.pathname.includes('docente')) {
            this._sigaaSession.status = 'LOGGED'
            this._sigaaSession.userType = 'TEACHER'
          } else {
            this._sigaaSession.status = 'LOGGED'
            this._sigaaSession.userType = 'UNKNOWN'
          }
          resolve(true)
        }
      } else {
        reject(new Error(`SIGAA_STATUSCODE_${page.statusCode}`))
      }
    })
  }
}
module.exports = SigaaLogin
