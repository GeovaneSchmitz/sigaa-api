const https = require('https')
const http = require('https')
const querystring = require('querystring')
const Cheerio = require('cheerio')
const htmlEntities = require('he')
const SigaaErrors = require('./sigaa-errors')
const SigaaSession = require('./sigaa-session')
const stream = require('stream')
const zlib = require('zlib')

/**
 * Varable to request in cascade
 * @private
 */
let requestChainWithoutCookies = { promise: Promise.resolve(), length: 0 }
/**
 * HTTP request and response utility class
 * @class SigaaBase
 * @param {SigaaSession} sigaaSession A instance of SigaaSession
 * @throws {SigaaErrors.SIGAA_SESSION_IS_NECESSARY} If sigaaSession is not an instance of Sigaa Session
 * @private
 */
class SigaaBase {
  constructor(sigaaSession) {
    if (sigaaSession instanceof SigaaSession) {
      this._sigaaSession = sigaaSession
    } else {
      throw new Error(SigaaErrors.SIGAA_SESSION_IS_NECESSARY)
    }
  }

  /**
   * Create object Options for https.request
   * @param {('GET'|'POST')} method HTTP method POST or GET
   * @param {URL} link URL of Request
   * @param {Object} options
   * @param {Boolean} [options.withoutCookies=true] Disable cookies in headers, default = true
   * @returns {Object} The basic options for request
   * @private
   */
  _makeRequestBasicOptions(method, link, options = { withoutCookies: false }) {
    const basicOptions = {
      hostname: link.hostname,
      port: 443,
      path: link.pathname + link.search,
      method: method,
      headers: {
        'User-Agent':
          'SIGAA-Api/1.0 (https://github.com/GeovaneSchmitz/SIGAA-node-interface)',
        'Accept-Encoding': 'br, gzip, deflate',
        Accept: '*/*',
        'Cache-Control': 'max-age=0',
        DNT: 1
      }
    }
    if (method === 'POST') {
      basicOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded'
    }

    if (
      !options.withoutCookies &&
      this._sigaaSession.getTokenByDomain(link.hostname)
    ) {
      basicOptions.headers.Cookie = this._sigaaSession.getTokenByDomain(
        link.hostname
      )
    }
    return basicOptions
  }
  /**
   * Parse all dates in dateString in format dd/mm/yy, dd/mm/yy hh:mm, dd/mm/yy hh'h'mm
   * @param {String} dateString String to parse
   * @return {Array<Date>} Dates found in string
   */
  _parseDates(dateString) {
    const dateStrings = dateString.match(/[0-9]+[\S\s]+?[0-9]((?= )|(?=$))/g)
    const createDateFromString = (dataString, timeString) => {
      const dateSplited = dataString.match(/[0-9]+/g)
      if (!timeString) {
        timeString = '00:00'
      }
      const timeSplited = timeString.match(/[0-9]+/g)
      const year = dateSplited[2]
      const month = dateSplited[1]
      const day = dateSplited[0]
      const hour = ('0' + timeSplited[0]).substr(-2)
      const minutes = ('0' + timeSplited[1]).substr(-2)
      const seconds = timeSplited[2] ? ('0' + timeSplited[2]).substr(-2) : '00'
      return new Date(
        `${year}-${month}-${day}T${hour}:${minutes}:${seconds}.000`
      )
    }
    const dates = []
    let currentDate
    for (let i = 0; i < dateStrings.length; i++) {
      if (dateStrings[i].includes('/')) {
        currentDate = dateStrings[i]
        if (
          dateStrings[i + 1] &&
          (dateStrings[i + 1].includes(':') || dateStrings[i + 1].includes('h'))
        ) {
          dates.push(createDateFromString(dateStrings[i], dateStrings[i + 1]))
          i++
          continue
        } else {
          dates.push(createDateFromString(dateStrings[i]))
          continue
        }
      }
      if (
        currentDate &&
        (dateStrings[i].includes(':') || dateStrings[i].includes('h'))
      ) {
        dates.push(createDateFromString(currentDate, dateStrings[i]))
      }
    }
    return dates
  }
  /**
   * Make a POST multipart request
   * @async
   * @param {String} path The path of request or full URL
   * @param {FormData} formData instance of FormData
   * @returns {Promise<Object>}
   * @protected
   */
  async _postMultipart(path, formData) {
    const link = new URL(path, this._sigaaSession.url)
    const httpOptions = this._makeRequestBasicOptions('POST', link)

    httpOptions.headers = {
      ...httpOptions.headers,
      ...formData.headers
    }

    const buffer = await this._convertReadebleToBuffer(formData.stream)
    const page = await this._sigaaSession.postRequestChain({
      url: link,
      shareSameRequest: false,
      requestPromiseFunction: () =>
        this._requestChain(link, httpOptions, buffer)
    })
    if (page.statusCode === 200 && formData.get('javax.faces.ViewState')) {
      this._sigaaSession.reactivateCachePageByViewState(
        formData.get('javax.faces.ViewState')
      )
    }
    return page
  }
  /**
   * Convert stream.Readable to buffer
   * @param {stream.Readable} stream readable stream
   * @return {Promise<Buffer>}
   * @async
   */
  _convertReadebleToBuffer(stream) {
    const buffers = []
    return new Promise((resolve, reject) => {
      stream.on('data', (buffer) => {
        buffers.push(buffer)
      })

      stream.on('end', () => {
        const buffer = Buffer.concat(buffers)
        resolve(buffer)
      })

      stream.on('error', (err) => {
        reject(err)
      })
    })
  }
  /**
   * Make a POST request
   * @async
   * @param {String} path The path of request or full URL
   * @param {Object} postValues Post values in format, key as field name, and value as field value.
   * @param {Object} [options]
   * @param {boolean} [options.noCache] If can retrieve from cache
   * @returns {Promise<Object>}
   * @protected
   */
  async _post(path, postValues, options = {}) {
    const link = new URL(path, this._sigaaSession.url)
    const httpOptions = this._makeRequestBasicOptions('POST', link)
    const body = querystring.stringify(postValues)
    httpOptions.headers['Content-Length'] = Buffer.byteLength(body)
    let cachePage = null
    if (!(options && options.noCache === true)) {
      cachePage = this._sigaaSession.getPage({
        method: 'POST',
        url: link.href,
        requestHeaders: httpOptions.headers,
        postValues
      })
    }
    if (cachePage) {
      return cachePage
    } else {
      const page = await this._sigaaSession.postRequestChain({
        url: link,
        body,
        shareSameRequest: options.shareSameRequest,
        requestPromiseFunction: () =>
          this._requestChain(link, httpOptions, body)
      })
      if (page.statusCode === 200) {
        if (postValues && postValues['javax.faces.ViewState']) {
          this._sigaaSession.reactivateCachePageByViewState(
            postValues['javax.faces.ViewState']
          )
        }
        this._storePage(page, httpOptions, link, body)
      }

      return page
    }
  }

  /**
   * @readonly
   * @static
   * @enum UserTypes
   */
  static get userTypes() {
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
  static get userLoginStates() {
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
   * @param {Object} [options]
   * @param {boolean} [options.noCache] If can retrieve from cache
   * @returns {Promise<Object>}
   * @protected
   */
  async _get(path, options) {
    const link = new URL(path, this._sigaaSession.url)

    const httpOptions = this._makeRequestBasicOptions('GET', link)

    let cachePage = null
    if (!(options && options.noCache === true)) {
      cachePage = this._sigaaSession.getPage({
        method: 'GET',
        url: link.href,
        requestHeaders: httpOptions.headers
      })
    }
    if (cachePage) {
      return cachePage
    } else {
      const page = await this._sigaaSession.storeRunningGetRequest({
        path: link,
        requestPromiseFunction: () => this._requestChain(link, httpOptions)
      })
      this._storePage(page, httpOptions, link)
      return page
    }
  }

  /**
   * Make a HTTP request for a page
   * @async
   * @param {URL} link url of request
   * @param {Object} options http.request options
   * @param {String} [requestBody] body of request
   * @returns {Promise<Object>}
   * @private
   */
  _requestPage(link, options, requestBody) {
    return this._requestHTTP(options, requestBody).then(
      ({ bodyStream, headers, statusCode }) => {
        return this._convertReadebleToBuffer(bodyStream).then((bodyBuffer) => {
          return {
            body: bodyBuffer.toString(),
            url: link,
            headers,
            statusCode
          }
        })
      }
    )
  }
  /**
   * Make a HTTP request
   * @async
   * @param {Object} optionsHTTP http.request options
   * @param {String} [body] body of request
   * @param {Object} [options]
   * @param {Boolean} [options.notSaveCookie] do not store cookies received
   * @returns {Promise<true>}
   * @private
   */
  _requestHTTP(optionsHTTP, body, options = { notSaveCookie: false }) {
    return new Promise((resolve, reject) => {
      const req = https.request(optionsHTTP, (response) => {
        let streamDecompressed
        switch (response.headers['content-encoding']) {
          case 'br':
            streamDecompressed = zlib.createBrotliDecompress()
            response.pipe(streamDecompressed)
            break
          case 'gzip':
            streamDecompressed = zlib.createGunzip()
            response.pipe(streamDecompressed)
            break
          case 'deflate':
            streamDecompressed = zlib.createInflate()
            response.pipe(streamDecompressed)
            break
          default:
            streamDecompressed = response
            break
        }
        if (!options.notSaveCookie && response.headers['set-cookie']) {
          const cookies = response.headers['set-cookie'].join(' ')
          const token = cookies.match(/JSESSIONID=[^;]*/g)
          if (token) {
            this._sigaaSession.setToken(optionsHTTP.hostname, token[0])
          }
        }
        if (Array.isArray(response.headers.location)) {
          response.headers.location = response.headers.location[0]
        }
        resolve({
          bodyStream: streamDecompressed,
          headers: response.headers,
          statusCode: response.statusCode
        })
      })

      req.on('error', (err) => {
        reject(err)
      })
      if (body) req.write(body)
      req.end()
    })
  }
  /**
   * Store page in cache
   * @param {https.IncomingMessage} page
   * @param {Object} options
   * @param {URL} link
   * @param {string} body body of request
   */
  _storePage(page, options, link, body) {
    if (page.statusCode === 200) {
      const $ = Cheerio.load(page.body, {
        normalizeWhitespace: true
      })
      const responseViewStateEl = $("input[name='javax.faces.ViewState']")
      let responseViewState = null
      if (responseViewStateEl) {
        responseViewState = responseViewStateEl.val()
      }

      this._sigaaSession.storePage({
        method: options.method,
        url: link,
        requestHeaders: options.headers,
        responseHeaders: page.headers,
        body: body || null,
        viewState: responseViewState
      })
    }
  }

  /**
   * Promise chain request if needed
   * @param {URL} link url of request
   * @param {Object} options http.request options
   * @param {String} [body] body of request
   * @returns {Promise<http.ClientRequest>}
   */
  _requestChain(link, options, body) {
    return new Promise((resolve, reject) => {
      if (!options.headers.Cookie) {
        requestChainWithoutCookies.length++
        const cascadeLength = requestChainWithoutCookies.length
        requestChainWithoutCookies.promise = requestChainWithoutCookies.promise
          .then(() => this._requestPage(link, options, body))
          .then((req) => resolve(req))
          .catch((err) => reject(err))
          .finally(() => {
            if (requestChainWithoutCookies.length === cascadeLength) {
              requestChainWithoutCookies.promise = Promise.resolve()
              requestChainWithoutCookies.length = 0
            }
          })
      } else {
        resolve(this._requestPage(link, options, body))
      }
    })
  }
  /**
   * Clears text by removing all HTML tags and fix encoding characters
   * @param {String} text
   * @returns {String}
   * @protected
   */
  _removeTagsHtml(text) {
    try {
      const removeTags = [
        {
          pattern: ['span', 'em', 'b', 'i', 'strong'], // remove without add space
          replacement: ''
        }
      ]
      const replacesBeforeParseHTMLCharacters = [
        {
          pattern: /\n|\xA0|\t/g, // match tabs, break lines, etc
          replacement: ' '
        },
        {
          pattern: /&middot;/g, // replace middle dot with \n and middle dot
          replacement: '\n&middot;'
        },
        {
          pattern: /<\/li>|<\/p>|<br\/>|<br>|<br \/>/gm, //tags to replace with \n
          replacement: '\n'
        },
        {
          pattern: /<script([\S\s]*?)>([\S\s]*?)<\/script>|<style([\S\s]*?)style>|<[^>]+>|\t/gm, //remove all tags
          replacement: ' '
        }
      ]
      const replacesAfterParseHTMLCharacters = [
        {
          pattern: new RegExp(String.fromCharCode(160), 'g'), // replace NBSP with space
          replacement: ' '
        },
        {
          pattern: / + /gm, //removes multiple whitespaces
          replacement: ' '
        },
        {
          pattern: /\n+\n/gm, //removes multiple break lines
          replacement: '\n'
        },
        {
          pattern: /\s+\s/gm, //removes multiple \s
          replacement: '\n'
        },
        {
          pattern: /^(\s)*|(\s)*$/gm, //remove whitespace from beginning and end
          replacement: ''
        }
      ]

      let newText = text
      for (const replace of removeTags) {
        for (const tag of replace.pattern) {
          newText = newText.replace(
            RegExp(`<${tag}>|<${tag} [\s\S]*?>|</${tag}>`, 'g'),
            replace.replacement
          )
        }
      }
      for (const replace of replacesBeforeParseHTMLCharacters) {
        newText = newText.replace(replace.pattern, replace.replacement)
      }
      newText = htmlEntities.decode(newText)
      for (const replace of replacesAfterParseHTMLCharacters) {
        newText = newText.replace(replace.pattern, replace.replacement)
      }
      return newText.trim()
    } catch (err) {
      return ''
    }
  }
  /**
   * Fix encoding characters and clears text by removing all HTML tags except strong, em, b and i
   * @param {String} text
   * @returns {String}
   * @protected
   */
  _removeTagsHtmlKeepingEmphasis(text) {
    try {
      const keepTags = [
        '<b>',
        '</b>',
        '<i>',
        '</i>',
        '<strong>',
        '</strong>',
        '<em>',
        '</em>'
      ]

      let newText = text.replace(/<li>/g, '&middot;')
      for (const tag of keepTags) {
        const replaceTag = tag.replace(/</g, '&lt;').replace(/>/g, '&gt;')
        newText = newText.replace(new RegExp(tag, 'g'), replaceTag)
      }
      return this._removeTagsHtml(newText)
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
  _checkPageStatusCodeAndExpired(page) {
    if (page.statusCode === 200) {
      return page
    } else if (
      page.statusCode === 302 &&
      page.headers.location.includes('/sigaa/expirada.jsp')
    ) {
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
  _parseJSFCLJS(javaScriptCode, $) {
    if (javaScriptCode.includes('getElementById')) {
      const formQuery = javaScriptCode.replace(
        /if([\S\s]*?)getElementById\('|'([\S\s]*?)false/gm,
        ''
      )
      const formEl = $(`#${formQuery}`)
      if (!formEl) {
        throw new Error(SigaaErrors.SIGAA_SFCLJS_FORM_NOT_FOUND)
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
      formEl.find("input:not([type='submit'])").each(function() {
        form.postValues[$(this).attr('name')] = $(this).val()
      })
      const postValuesJSFCLJ = JSON.parse(postValuesString)
      Object.assign(form.postValues, postValuesJSFCLJ)
      return form
    } else {
      throw new Error(SigaaErrors.SIGAA_SFCLJS_FORM_NOT_FOUND)
    }
  }

  /**
   * Follow the redirect while the page response redirects to another page
   * @param {Object} page
   * @returns {Promise<Object>} The last page of redirects
   * @async
   * @protected
   */
  async followAllRedirect(page) {
    while (page.headers.location) {
      page = await this._get(page.headers.location)
    }
    return page
  }
}
module.exports = SigaaBase
