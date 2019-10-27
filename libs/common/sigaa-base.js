const https = require('https')
const querystring = require('querystring')
const Cheerio = require('cheerio')
const htmlEntities = require('he')

class sigaaBase {
  constructor (sigaaSession) {
    if (sigaaSession) {
      this._sigaaSession = sigaaSession
    } else {
      throw new Error('SIGAA_SESSION_IS_NECESSARY')
    }
  }

  _requestBasicOptions (method, link) {
    const basicOptions = {
      hostname: link.hostname,
      port: 443,
      path: link.pathname + link.search,
      method: method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:64.0) Gecko/20100101 Firefox/64.0'
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

  _post (path, postOptions, params) {
    const link = new URL(path, this._sigaaSession.url)
    const options = this._requestBasicOptions('POST', link)
    const body = querystring.stringify(postOptions)
    options.headers['Content-Length'] = Buffer.byteLength(body)
    return new Promise((resolve, reject) => {
      if (!(params && params.noCache === true)) {
        var cachePage = this._sigaaSession.getPage(
          'POST',
          link.href,
          options.headers,
          postOptions
        )
      }
      if (cachePage) {
        resolve(cachePage)
      } else {
        resolve(this._request(link, options, postOptions, body))
      }
    })
  }

  _get (path, params) {
    const link = new URL(path, this._sigaaSession.url)

    const options = this._requestBasicOptions('GET', link)

    return new Promise(resolve => {
      if (!(params && params.noCache === true)) {
        var cachePage = this._sigaaSession.getPage('GET', link.href, options.headers)
      }
      if (cachePage) {
        resolve(cachePage)
      } else {
        resolve(this._request(link, options))
      }
    })
  }

  _request (link, options, postOptions, body) {
    return new Promise((resolve, reject) => {
      const req = https.request(options, res => {
        res.setEncoding('utf8')
        res.url = link
        if (res.headers['set-cookie']) {
          const cookies = res.headers['set-cookie']
          const token = cookies[cookies.length - 1].split(';')[0]
          this._sigaaSession.setToken(options.hostname, token)
        }
        if (Array.isArray(res.headers.location)) {
          res.headers.location = res.headers.location[0]
        }

        res.body = ''
        res.on('data', chunk => {
          res.body = res.body + chunk
        })

        res.on('end', () => {
          if (res.statusCode === 200) {
            const $ = Cheerio.load(res.body, {
              normalizeWhitespace: true
            })
            const responseViewStateEl = $("input[name='javax.faces.ViewState']")
            if (responseViewStateEl) {
              var responseViewState = responseViewStateEl.val()
            } else {
              responseViewState = false
            }
            if (postOptions && postOptions['javax.faces.ViewState']) {
              this._sigaaSession.reactivateCachePageByViewState(postOptions['javax.faces.ViewState'])
            }
            this._sigaaSession.storePage(options.method, {
              url: link,
              requestHeaders: options.headers,
              responseHeaders: res.headers,
              body: res.body,
              viewState: responseViewState,
              postOptions
            })
          }
          resolve(res)
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

  _checkPageStatusCodeAndExpired (page) {
    return new Promise((resolve, reject) => {
      if (page.statusCode === 200) {
        resolve(page)
      } else if (page.statusCode === 302 && page.headers.location.includes('/sigaa/expirada.jsp')) {
        reject(new Error('ACCOUNT_SESSION_EXPIRED'))
      } else {
        reject(new Error(`SIGAA_STATUSCODE_${page.statusCode}`))
      }
    })
  }

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
      const postOptionsString =
      '{' +
      javaScriptCode
        .replace(/if([\S\s]*?),{|},([\S\s]*?)false/gm, '')
        .replace(/'/gm, '"') +
      '}'
      const form = {}
      form.action = new URL(formEl.attr('action'), this._sigaaSession.url).href
      form.postOptions = {}
      formEl.find("input:not([type='submit'])").each(function () {
        form.postOptions[$(this).attr('name')] = $(this).val()
      })
      const postOptionsJSFCLJ = JSON.parse(postOptionsString)
      Object.assign(form.postOptions, postOptionsJSFCLJ)
      return form
    } else {
      throw new Error('FORM_NOT_FOUND')
    }
  }

  async followAllRedirect (res) {
    while (res.headers.location) {
      res = await this._get(res.headers.location)
    }
    return res
  }
}
module.exports = sigaaBase
