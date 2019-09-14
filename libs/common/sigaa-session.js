class SigaaSession {
  constructor (timeout) {
    this._cachePages = []
    if (timeout) {
      this.timeout = timeout
    } else {
      this.timeout = 5 * 60 // 5min
    }
    this._tokens = {}
  }

  toJSON () {
    const sessionObj = {}
    sessionObj.tokens = this._tokens
    sessionObj.timeout = this.timeout
    sessionObj.userType = this.userType
    sessionObj.url = this.url
    sessionObj.cachePages = this._cachePages
    sessionObj.status = this.status
    sessionObj.formLoginAction = this.formLoginAction
    sessionObj.formLoginPostOptions = this.formLoginPostOptions
    return sessionObj
  }

  parseJSON (sessionObj) {
    if (sessionObj.tokens !== undefined &&
      sessionObj.timeout !== undefined &&
      sessionObj.url !== undefined &&
      sessionObj.cachePages !== undefined) {
      for (const key of Object.keys(sessionObj.tokens)) {
        this.setToken(key, sessionObj.tokens[key])
      }
      if (sessionObj.userType !== undefined) {
        this.userType = sessionObj.userType
      }
      if (sessionObj.status !== undefined) {
        this.status = sessionObj.status
      }
      if (sessionObj.formLoginAction !== undefined) {
        this.formLoginAction = sessionObj.formLoginAction
      }
      if (sessionObj.formLoginPostOptions !== undefined) {
        this.formLoginPostOptions = sessionObj.formLoginPostOptions
      }
      this.timeout = sessionObj.timeout
      this.url = sessionObj.url
      this._cachePages = sessionObj.cachePages
    } else {
      throw new Error('INVALID_JSON_OBJECT')
    }
  }

  get timeout () {
    return this._timeout
  }

  set timeout (timeout) {
    this._timeout = timeout
  }

  get status () {
    return this._status
  }

  set status (status) {
    if (typeof status === 'string') {
      this._status = status
    } else {
      throw new Error('STATUS_IS_NOT_A_STRING')
    }
  }

  get userType () {
    return this._userType
  }

  set userType (userType) {
    if (typeof userType === 'string') {
      this._userType = userType
    } else {
      throw new Error('USERTYPE_IS_NOT_A_STRING')
    }
  }

  getTokenByDomain (domain) {
    return this._tokens[domain]
  }

  setToken (domain, token) {
    if (typeof domain !== 'string') {
      throw new Error('DOMAIN_IS_NOT_A_STRING')
    }
    if (typeof token === 'string') {
      this._tokens[domain] = token
    } else {
      throw new Error('TOKEN_IS_NOT_A_STRING')
    }
  }

  get formLoginAction () {
    return this._formLoginAction
  }

  set formLoginAction (data) {
    if (typeof data === 'string') {
      this._formLoginAction = data
    } else {
      throw new Error('FORM_LOGIN_ACTION_IS_NOT_A_STRING')
    }
  }

  get formLoginPostOptions () {
    return this._formLoginPostOptions
  }

  set formLoginPostOptions (data) {
    if (typeof data === 'object') {
      this._formLoginPostOptions = data
    } else {
      throw new Error('FORM_LOGIN_POST_OPTIONS_IS_NOT_A_OBJECT')
    }
  }

  get url () {
    return this._url
  }

  set url (data) {
    if (typeof data === 'string') {
      this._url = data
    } else {
      throw new Error('URL_IS_NOT_A_STRING')
    }
  }

  finish () {
    if (this._intervalId) {
      clearInterval(this._intervalId)
    }
    this._cachePages = []
  }

  storePage (method, params) {
    const page = {
      method,
      url: params.url.href,
      requestHeaders: params.requestHeaders,
      headers: params.responseHeaders,
      body: params.body,
      modifiedAt: Date.now(),
      viewState: params.viewState
    }
    if (!this._intervalId) {
      this._intervalId = setInterval(() => {
        this._cachePages = this._cachePages.filter(cachePage => {
          return !(cachePage.modifiedAt < Date.now() - this.timeout)
        })
        if (this._cachePages.length === 0) {
          clearInterval(this._intervalId)
        }
      }, 15000)
    }
    if (method === 'POST') page.postOptions = params.postOptions
    var replace = false
    this._cachePages = this._cachePages.map(cachePage => {
      if (cachePage.url === page.url && cachePage.requestHeaders === page.requestHeaders) {
        if (method === 'POST') {
          if (JSON.stringify(page.postOptions) === JSON.stringify(cachePage.page)) {
            replace = true
            return page
          } else {
            return cachePage
          }
        } else {
          replace = true
          return page
        }
      }
      return cachePage
    })

    if (!replace) {
      this._cachePages.push(page)
    }
    if (this._cachePages.length > 15) {
      this._cachePages.shift()
    }
  }

  reactivateCachePageByViewState (viewState) {
    const index = this._cachePages.findIndex((cachePage) => {
      return cachePage.viewState === viewState
    })
    if (index !== -1) {
      this._cachePages[index].modifiedAt = Date.now()
      this._cachePages.push(this._cachePages.splice(index, 1)[0])
    }
  }

  getPage (method, url, headers, postOptions) {
    const cachePage = this._cachePages.find((cachePage) => {
      if (method === 'GET') {
        return method === cachePage.method && cachePage.url === url &&
                JSON.stringify(cachePage.requestHeaders) && JSON.stringify(headers)
      } else if (method === 'POST') {
        return method === cachePage.method &&
                cachePage.url === url &&
                JSON.stringify(cachePage.requestHeaders) === JSON.stringify(headers) &&
                JSON.stringify(cachePage.postOptions) === JSON.stringify(postOptions)
      }
    })
    if (cachePage) {
      const copyCachePage = JSON.parse(JSON.stringify(cachePage))
      copyCachePage.url = new URL(copyCachePage.url)
      copyCachePage.statusCode = 200
      return copyCachePage
    }
    return false
  }
}
module.exports = SigaaSession
