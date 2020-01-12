const https = require('https')
const querystring = require('querystring')
const Cheerio = require('cheerio')
const htmlEntities = require('he')
const SigaaErrors = require('./sigaa-errors')
const SigaaSession = require('./sigaa-session')
/**
 * HTTP request and response utility class
 * @class SigaaBase
 * @private
 */
class SigaaBase {
  /**
   * @param {SigaaSession} sigaaSession A instance of SigaaSession
   * @throws {SIGAA_SESSION_IS_NECESSARY} If sigaaSession is not an instance of Sigaa Session
   */
  constructor (sigaaSession) {
    if (sigaaSession instanceof SigaaSession) {
      this._sigaaSession = sigaaSession
    } else {
      throw new Error('SIGAA_SESSION_IS_NECESSARY')
    }
  }

  /**
   * Create object Options for https.request
   * @param {('GET'|'POST')} method HTTP method POST or GET
   * @param {URL} link URL of Request
   * @returns {Object} The basic options for request
   * @private
   */
  _makeRequestBasicOptions (method, link) {
    const basicOptions = {
      hostname: link.hostname,
      port: 443,
      path: link.pathname + link.search,
      method: method,
      headers: {
        'User-Agent': 'SIGAA-Api/1.0 (https://github.com/GeovaneSchmitz/SIGAA-node-interface)'
      }
    }
    if (method === 'POST') {
      basicOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded'
    }
    if (this._sigaaSession.getTokenByDomain(link.hostname)) {
      basicOptions.headers.Cookie = this._sigaaSession.getTokenByDomain(link.hostname)
    }
    return basicOptions
  }

  /**
   * Make a POST request
   * @async
   * @param {String} path The path of request or full URL
   * @param {Object} postValues Post values in format, key as field name, and value as field value.
   * @param {Object} [params]
   * @param {boolean} [params.noCache] If can retrieve from cache
   * @returns {Promise<Object>}
   * @protected
   */
  _post (path, postValues, params) {
    const link = new URL(path, this._sigaaSession.url)
    const options = this._makeRequestBasicOptions('POST', link)
    const body = querystring.stringify(postValues)
    options.headers['Content-Length'] = Buffer.byteLength(body)
    return new Promise((resolve, reject) => {
      let cachePage = null
      if (!(params && params.noCache === true)) {
        cachePage = this._sigaaSession.getPage(
          'POST',
          link.href,
          options.headers,
          postValues
        )
      }
      if (cachePage) {
        resolve(cachePage)
      } else {
        resolve(this._request(link, options, postValues, body))
      }
    })
  }

  /**
   * @readonly
   * @static
   * @enum UserTypes
   */
  static get userTypes () {
    return {
      /** 'STUDENT'; user is a student */
      STUDENT: 'STUDENT',
      /** 'TEACHER'; user is a teacher */
      TEACHER: 'TEACHER',
      /** 'UNAUTHENTICATED'; has no authenticated user */
      UNAUTHENTICATED: 'UNAUTHENTICATED'
    }
  }

  /**
   * @readonly
   * @static
   * @enum userLoginStates {String}
   */
  static get userLoginStates () {
    return {
      /** 'STUDENT'; user is a student */
      STUDENT: 'STUDENT',
      /** 'TEACHER'; user is a teacher */
      TEACHER: 'TEACHER',
      /** 'UNAUTHENTICATED'; has no authenticated user */
      UNAUTHENTICATED: 'UNAUTHENTICATED'
    }
  }

  /**
   * Make a GET request
   * @async
   * @param {String} path The path of request or full URL
   * @param {Object} [params]
   * @param {boolean} [params.noCache] If can retrieve from cache
   * @returns {Promise<Object>}
   * @protected
   */
  _get (path, params) {
    const link = new URL(path, this._sigaaSession.url)

    const options = this._makeRequestBasicOptions('GET', link)

    return new Promise(resolve => {
      let cachePage = null
      if (!(params && params.noCache === true)) {
        cachePage = this._sigaaSession.getPage('GET', link.href, options.headers)
      }
      if (cachePage) {
        resolve(cachePage)
      } else {
        resolve(this._request(link, options))
      }
    })
  }

  /**
   * Make a HTTP request
   * @async
   * @param {URL} link url of request
   * @param {Object} options http.request options
   * @param {Object} [postValues] Post values in format, key as field name, and value as field value.
   * @param {String} [body] body of request
   * @returns {Promise<http.ClientRequest>}
   * @private
   */
  _request (link, options, postValues, body) {
    return new Promise((resolve, reject) => {
      const req = https.request(options, page => {
        page.setEncoding('utf8')
        page.url = link
        if (page.headers['set-cookie']) {
          const cookies = page.headers['set-cookie']
          const token = cookies[cookies.length - 1].split(';')[0]
          this._sigaaSession.setToken(options.hostname, token)
        }
        if (Array.isArray(page.headers.location)) {
          page.headers.location = page.headers.location[0]
        }

        page.body = ''
        page.on('data', chunk => {
          page.body = page.body + chunk
        })

        page.on('end', () => {
          if (page.statusCode === 200) {
            const $ = Cheerio.load(page.body, {
              normalizeWhitespace: true
            })
            const responseViewStateEl = $("input[name='javax.faces.ViewState']")
            let responseViewState = null
            if (responseViewStateEl) {
              responseViewState = responseViewStateEl.val()
            }
            if (postValues && postValues['javax.faces.ViewState']) {
              this._sigaaSession.reactivateCachePageByViewState(postValues['javax.faces.ViewState'])
            }
            this._sigaaSession.storePage({
              method: options.method,
              url: link,
              requestHeaders: options.headers,
              responseHeaders: page.headers,
              body: page.body,
              viewState: responseViewState,
              postValues
            })
          }
          resolve(page)
        })
      })

      req.on('error', e => {
        const response = {
          status: 'ERROR',
          errorCode: e.code,
          error: e
        }
        reject(response)
      })

      if (options.method === 'POST') req.write(body)
      req.end()
    })
  }

  /**
   * Clears text by removing all HTML tags and fix encoding characters
   * @param {String} text
   * @returns {String}
   * @protected
   */
  _removeTagsHtml (text) {
    try {
      const removeNbsp = new RegExp(String.fromCharCode(160), 'g')
      const textWithoutBreakLinesHtmlAndTabs = text.replace(/\n|\xA0|\t/gm, ' ')
      const textWithBreakLines = textWithoutBreakLinesHtmlAndTabs.replace(/<p>|<br\/>|<br>/gm, '\n')
      const textWithoutHtmlTags = textWithBreakLines.replace(/<script([\S\s]*?)>([\S\s]*?)<\/script>|<style([\S\s]*?)style>|<([\S\s]*?)>|<[^>]+>| +(?= )|\t/gm, '')
      const textWithHtmlParsed = htmlEntities.decode(textWithoutHtmlTags)
      const textWithoutNbsp = textWithHtmlParsed.replace(removeNbsp, ' ')
      return textWithoutNbsp.replace(/^(\s|\n)*|(\s|\n)*$/gm, '').trim()
    } catch (err) {
      return ''
    }
  }

  /**
   * Verify if page StatusCode is 200 or if session is expired
   * @param {Object} page The page to Verify
   * @returns {Object} The same page
   * @throws {SIGAA_SESSION_EXPIRED} If page is a redirect to expired page
   * @throws {SIGAA_UNEXPECTED_RESPONSE} If page statusCode isn't 200
   * @protected
   */
  _checkPageStatusCodeAndExpired (page) {
    if (page.statusCode === 200) {
      return page
    } else if (page.statusCode === 302 && page.headers.location.includes('/sigaa/expirada.jsp')) {
      return new Error(SigaaErrors.SIGAA_SESSION_EXPIRED)
    } else {
      return new Error(SigaaErrors.SIGAA_UNEXPECTED_RESPONSE)
    }
  }

  /**
   * Extracts the javascript function JSFCLJS from the page,
   * this function on the page redirects the user to another
   * page using the POST method, often this function is in
   * the onclick attribute on a page element.
   * @returns {object} Object with URL action and POST values equivalent to function
   * @param {String} javaScriptCode
   * @param {Function} $ the cheerio context of page
   * @protected
   */
  _extractJSFCLJS (javaScriptCode, $) {
    if (javaScriptCode.includes('getElementById')) {
      const formQuery = javaScriptCode.replace(
        /if([\S\s]*?)getElementById\('|'([\S\s]*?)false/gm,
        ''
      )
      const formEl = $(`#${formQuery}`)
      if (!formEl) {
        throw new Error('FORM_NOT_FOUND')
      }
      const postValuesString =
      '{' +
      javaScriptCode
        .replace(/if([\S\s]*?),{|},([\S\s]*?)false/gm, '')
        .replace(/'/gm, '"') +
      '}'
      const form = {}
      form.action = new URL(formEl.attr('action'), this._sigaaSession.url).href
      form.postValues = {}
      formEl.find("input:not([type='submit'])").each(function () {
        form.postValues[$(this).attr('name')] = $(this).val()
      })
      const postValuesJSFCLJ = JSON.parse(postValuesString)
      Object.assign(form.postValues, postValuesJSFCLJ)
      return form
    } else {
      throw new Error('FORM_NOT_FOUND')
    }
  }

  /**
   * Follow the redirect while the page response redirects to another page
   * @param {Object} page
   * @returns {Promise<Object>} The last page of redirects
   * @async
   * @protected
   */
  async followAllRedirect (page) {
    while (page.headers.location) {
      page = await this._get(page.headers.location)
    }
    return page
  }
}
module.exports = SigaaBase
