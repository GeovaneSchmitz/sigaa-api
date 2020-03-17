const SigaaErrors = require('./sigaa-errors')
const SigaaTypes = require('./sigaa-types')
/**
 * @class SigaaSession
 * Store information like: states, cookies, page cache
 */
class SigaaSession {
  constructor() {
    /**
     * @property {Array} Array of all pages in cache
     * @private
     */
    this._cachePages = []
    /**
     * Running GET requests, to avoid duplicate requests at the same time
     * @private
     */
    this._runningGetRequest = {}
    /**
     * Stores the execution of POST requests, to avoid POST requests at the same time and to create cascading requests
     * @private
     */
    this._chainPostRequests = []

    this.timeoutCache = 5 * 60 * 1000 // 5min
    /**
     * @private
     * @property {Object}
     */
    this._tokens = {}
    this.userLoginState = SigaaTypes.userLoginStates.UNAUTHENTICATED
    this.userType = SigaaTypes.userTypes.UNAUTHENTICATED
    this.formLoginPostValues = null
    this.formLoginAction = null
  }

  /**
   * @description Used to store the login form URL to improve login performance
   * @type {string}
   * @throws {SIGAA_FORM_LOGIN_ACTION_IS_NOT_A_STRING}
   */
  set formLoginAction(action) {
    if (typeof action === 'string' || action === null) {
      this._formLoginAction = action
    } else {
      throw new Error(SigaaErrors.SIGAA_FORM_LOGIN_ACTION_IS_NOT_A_STRING)
    }
  }

  get formLoginAction() {
    return this._formLoginAction
  }

  /**
   * @description Used to store the login form field values to improve login performance, key as field name, and value as field value.
   * @type {object}
   * @throws {SIGAA_FORM_LOGIN_POST_VALUES_IS_NOT_A_OBJECT}
   */
  set formLoginPostValues(postValues) {
    if (typeof postValues === 'object' || postValues === null) {
      this._formLoginPostValues = postValues
    } else {
      throw new Error(SigaaErrors.SIGAA_FORM_LOGIN_POST_VALUES_IS_NOT_A_OBJECT)
    }
  }

  get formLoginPostValues() {
    return this._formLoginPostValues
  }

  /**
   * @description URL base of all request, example: https://sigaa.ifsc.edu.br
   * @type {String}
   * @throws {SIGAA_URL_IS_NOT_A_STRING}
   */
  set url(data) {
    if (typeof data === 'string') {
      this._url = data
    } else {
      throw new Error(SigaaErrors.SIGAA_URL_IS_NOT_A_STRING)
    }
  }

  get url() {
    return this._url
  }

  /**
   * @description Timeout in milliseconds to keep page cached
   * @type {Number}
   */
  set timeoutCache(timeout) {
    this._timeoutCache = timeout
  }

  get timeoutCache() {
    return this._timeoutCache
  }

  /**
   * @description Login status, true represents authenticated user and false represents unauthenticated user
   * @type {userLoginStatus}
   * @throws {SIGAA_USER_LOGIN_STATUS_IS_NOT_A_BOOLEAN}
   */
  set userLoginState(status) {
    if (typeof status === 'boolean') {
      this._loginState = status
    } else {
      throw new Error(SigaaErrors.SIGAA_USER_LOGIN_STATUS_IS_NOT_A_BOOLEAN)
    }
  }

  get userLoginState() {
    return this._loginState
  }

  /**
   * @description Represents user type
   * @example
   * // if user is student
   * const session = new SigaaSession()
   * ...
   * if (session.userType === SigaaAccount.userTypes.STUDENT) {
   * // user is a student
   * }
   * @example
   * // if user is teacher
   * const session = new SigaaSession()
   * ...
   * if(session.userType === SigaaAccount.userTypes.TEACHER) {
   *  //user is a teacher
   * }
   * @type {SigaaAccount.userTypes}
   * @throws {SigaaErrors.SIGAA_USERTYPE_IS_NOT_A_VALID_VALUE} if the user type is not in the list of valid types
   */
  get userType() {
    return this._userType
  }

  set userType(userType) {
    const validUsersTypes = Object.keys(SigaaTypes.userTypes)
    if (validUsersTypes.includes(userType)) {
      this._userType = userType
    } else {
      throw new Error(SigaaErrors.SIGAA_USERTYPE_IS_NOT_A_VALID_VALUE)
    }
  }

  /**
   * Returns domain cookie JSESSIONID (token) or undefined if nothing
   * @param {String} domain domain of cookie
   * @returns {String}
   */
  getTokenByDomain(domain) {
    return this._tokens[domain]
  }

  /**
   * @description Store cookie JSESSIONID (token) for domain URL
   * @param {String} domain Token URL domain without https:// only URL hostname
   * @param {token} token token to store
   * @throws {DOMAIN_IS_NOT_A_STRING}
   * @throws {TOKEN_IS_NOT_A_STRING}
   */
  setToken(domain, token) {
    if (typeof domain !== 'string') {
      throw new Error(SigaaErrors.SIGAA_DOMAIN_IS_NOT_A_STRING)
    }
    if (typeof token === 'string') {
      this._tokens[domain] = token
    } else {
      throw new Error(SigaaErrors.SIGAA_TOKEN_IS_NOT_A_STRING)
    }
  }

  /**
   * Create an object representing the session that contains cached cookies, pages, and states and can convert it using JSON.stringify.
   * Can be restored using parseJSON()
   * @example
   * const sessionObject = SigaaSession.toJSON()
   * const newSessionSigaaSession = new SigaaSession()
   * //transfer to new SigaaSession
   * const sessionObject = newSessionSigaaSession.parseJSON(sessionObject)
   * @returns {Object} Object represents session
   */
  toJSON() {
    const sessionObj = {}
    sessionObj.tokens = this._tokens
    sessionObj.timeoutCache = this.timeoutCache
    sessionObj.userType = this.userType
    sessionObj.url = this.url
    sessionObj.cachePages = this._cachePages
    sessionObj.status = this.userLoginState
    sessionObj.formLoginAction = this.formLoginAction
    sessionObj.formLoginPostValues = this.formLoginPostValues
    return sessionObj
  }

  /**
   * Imports an object created with SigaaSession.toJSON()
   * @example
   * const sessionObject = SigaaSession.toJSON()
   * const newSessionSigaaSession = new SigaaSession()
   * //transfer to new SigaaSession
   * const sessionObject = newSessionSigaaSession.parseJSON(sessionObject)
   * @param {Object} sessionObject represents session
   * @throws {SIGAA_INVALID_JSON_OBJECT} if the object does not contain the required properties
   */
  parseJSON(sessionObject) {
    if (
      sessionObject.tokens !== undefined &&
      sessionObject.timeoutCache !== undefined &&
      sessionObject.userType !== undefined &&
      sessionObject.url !== undefined &&
      sessionObject.cachePages !== undefined
    ) {
      for (const key of Object.keys(sessionObject.tokens)) {
        this.setToken(key, sessionObject.tokens[key])
      }
      if (sessionObject.userType !== undefined) {
        this.userType = sessionObject.userType
      }
      if (sessionObject.status !== undefined) {
        this.status = sessionObject.status
      }
      if (sessionObject.formLoginAction !== undefined) {
        this.formLoginAction = sessionObject.formLoginAction
      }
      if (sessionObject.formLoginPostValues !== undefined) {
        this.formLoginPostValues = sessionObject.formLoginPostValues
      }
      this.timeoutCache = sessionObject.timeoutCache
      this.url = sessionObject.url
      this._cachePages = sessionObject.cachePages
    } else {
      throw new Error(SigaaErrors.SIGAA_INVALID_JSON_OBJECT)
    }
  }
  /**
   * Create a request promise chain to reduce the request race condition
   * @param {function<Promise>} options.requestPromiseFunction function that returns a request promise
   * @param {String} options.body request Body
   * @param {String} options.shareSameRequest If you can only request once, return the same promise for same request (same body and same URL)
   * @param {URL} options.url request url
   */
  postRequestChain(options = {}) {
    const { requestPromiseFunction, body, url, shareSameRequest } = options
    if (shareSameRequest) {
      const runningPostRequest = this._chainPostRequests.find((request) => {
        return request.body === body && url.href === request.url
      })
      if (runningPostRequest) {
        return runningPostRequest.promise
      }
    }
    const promises = this._chainPostRequests.map((request) => request.promise)
    const promise = Promise.all(promises).then(
      () => requestPromiseFunction(),
      () => requestPromiseFunction()
    )
    this._storePostRequest(promise, { body, url })
    return promise
  }
  /**
   *
   * @param {String} {key} key of cascade
   * @param {Promise} {promise} to store
   */
  _storePostRequest(promise, { body, url }) {
    const index = this._chainPostRequests.length
    this._chainPostRequests.push({
      promise,
      body,
      url: url.href
    })
    promise.finally(() => {
      this._chainPostRequests.splice(index, 1)
    })
  }
  /**
   * Store running GET requests, to avoid duplicate requests at the same time
   * @param {URL} link Link of request
   * @param {function<Promise>} requestPromiseFunction function that returns a request promise
   */
  storeRunningGetRequest({ path, requestPromiseFunction }) {
    if (this._runningGetRequest[path.href]) {
      return this._runningGetRequest[path.href]
    } else {
      this._runningGetRequest[path.href] = requestPromiseFunction()
        .then((page) => {
          delete this._runningGetRequest[path.href]
          return page
        })
        .catch((error) => {
          delete this._runningGetRequest[path.href]
          throw error
        })
    }
    return this._runningGetRequest[path.href]
  }
  /**
   * @description flush states of instance
   */
  close() {
    this.userLoginState = SigaaTypes.userLoginStates.UNAUTHENTICATED
    this.userType = SigaaTypes.userTypes.UNAUTHENTICATED
    this._tokens = {}
    if (this._intervalId) {
      clearInterval(this._intervalId)
    }
    this._cachePages = []
  }

  /**
   * Cache a page or update if the same request values
   * @param {Object} pageObj
   * @param {('GET'|'POST')} pageObj.method Page HTTP request method. ex: POST, GET
   * @param {URL} pageObj.url Page URL
   * @param {Object} pageObj.requestHeaders Page HTTP request Headers
   * @param {Object} pageObj.responseHeaders The page HTTP response Headers
   * @param {String} pageObj.body Page body of response
   * @param {string} pageObj.viewState Page viewState is the value of the forms 'javax.faces.ViewState' field.
   */
  storePage(pageObj) {
    const page = {
      method: pageObj.method,
      url: pageObj.url.href,
      requestHeaders: pageObj.requestHeaders,
      headers: pageObj.responseHeaders,
      body: pageObj.body,
      modifiedAt: Date.now(),
      viewState: pageObj.viewState
    }
    if (!this._intervalId) {
      this._intervalId = setInterval(() => {
        this._cachePages = this._cachePages.filter((cachePage) => {
          return !(cachePage.modifiedAt < Date.now() - this.timeoutCache)
        })
        if (this._cachePages.length === 0) {
          clearInterval(this._intervalId)
        }
      }, this.timeoutCache)
    }
    let replace = false
    this._cachePages = this._cachePages.map((cachePage) => {
      if (
        cachePage.url === page.url &&
        cachePage.requestHeaders === page.requestHeaders
      ) {
        if (pageObj.method === 'POST') {
          if (page.body === cachePage.body) {
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

  /**
   * SIGAA has only 15 pages available to request form
   * contained therein, each page has its viewState
   * which indicates to SIGAA which page was made the
   * request. when a page receives a request the page
   * is moved to the top of the page stack available
   * for request
   *
   * This method moves a page to the top of the cache.
   * @param {string} viewState Page viewState is the value of the forms 'javax.faces.ViewState' field.
   */
  reactivateCachePageByViewState(viewState) {
    const index = this._cachePages.findIndex((cachePage) => {
      return cachePage.viewState === viewState
    })
    if (index !== -1) {
      this._cachePages[index].modifiedAt = Date.now()
      this._cachePages.push(this._cachePages.splice(index, 1)[0])
    }
  }

  /**
   * Get Page from cache
   * @param {Object} options
   * @param {('POST'|'GET')} options.method Method of request
   * @param {URL} options.url URL of request
   * @param {Object} options.requestHeaders requestHeaders in format, key as field name, and value as field value.
   * @param {Object} [options.body] body of request
   */
  getPage({ method, url, requestHeaders, body }) {
    const cachePage = this._cachePages.find((cachePage) => {
      if (method === 'GET') {
        return (
          method === cachePage.method &&
          cachePage.url === url.href &&
          JSON.stringify(cachePage.requestHeaders) &&
          JSON.stringify(requestHeaders)
        )
      } else if (method === 'POST') {
        return (
          method === cachePage.method &&
          cachePage.url === url.href &&
          JSON.stringify(cachePage.requestHeaders) ===
            JSON.stringify(requestHeaders) &&
          cachePage.body === body
        )
      }
    })
    if (cachePage) {
      const copyCachePage = JSON.parse(JSON.stringify(cachePage))
      copyCachePage.url = new URL(copyCachePage.url)
      copyCachePage.statusCode = 200
      return copyCachePage
    }
    return null
  }
}

module.exports = SigaaSession
