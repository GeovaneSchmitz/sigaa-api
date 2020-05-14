const SigaaSession = require('./sigaa-session')
const Cheerio = require('cheerio')
const http = require('http')

/**
 * response page of sigaa
 * @class SigaaPage
 * @private
 */
class SigaaPage {
  /**
   * @param {IncomingMessage} page A instance of SigaaSession
   * @param {URL} url A instance of URL
   * @throws {SIGAA_SESSION_IS_NECESSARY} If sigaaSession is not an instance of Sigaa Session
   * @throws {URL_IS_NECESSARY} If url is not an instance of URL
   */
  constructor(page, url) {
    if (page instanceof http.IncomingMessage) {
      requestHeaders: options.headers, responseHeaders
    } else {
      throw new Error(SigaaErrors.SIGAA_SESSION_IS_NECESSARY)
    }
    console.log(requestHeaders)
    if (url instanceof URL) {
      this._url = url
    } else {
      throw new Error('URL_IS_NECESSARY')
    }
  }

  /**
   *
   * @param {http.IncomingMessage} page
   */
  _parsePage(page) {
    page.setEncoding('utf8')

    this._body = ''
    page.on('data', (chunk) => {
      this._body += chunk
    })

    page.on('end', () => {
      this._headers = page.headers
      this._statusCode = page.statusCode
      if (Array.isArray(page.headers.location)) {
        this._headers.location = page.headers.location[0]
      }
      if (this.headers['set-cookie']) {
        const cookies = this.headers['set-cookie'].join(' ')
        const token = cookies.match(/JSESSIONID=[^;]*/g)
        if (token) {
          this._page.setToken(options.hostname, token[0])
        }
      }

      if (this.statusCode === 200) {
        const responseViewStateEl = this.$(
          "input[name='javax.faces.ViewState']"
        )
        let responseViewState = null
        if (responseViewStateEl) {
          responseViewState = responseViewStateEl.val()
        }
        if (postValues && postValues['javax.faces.ViewState']) {
          this._page.reactivateCachePageByViewState(
            postValues['javax.faces.ViewState']
          )
        }
        this._page.storePage({
          method: options.method,
          url: link,
          requestHeaders: options.headers,
          responseHeaders: page.headers,
          body: page.body,
          viewState: responseViewState,
          postValues
        })
      }
    })
  }
}
module.exports = SigaaPage
