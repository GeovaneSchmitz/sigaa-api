const https = require('https')
const querystring = require('querystring')
const { JSDOM } = require('jsdom')

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
    const link = new URL(path, this._sigaaSession.urlBase)
    const options = this._requestBasicOptions('POST', link)

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
        resolve(this._request(link, options, postOptions))
      }
    })
  }

  _get (path, params) {
    const link = new URL(path, this._sigaaSession.urlBase)

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

  _request (link, options, postOptions) {
    return new Promise((resolve, reject) => {
      if (postOptions) {
        var postOptionsString = querystring.stringify(postOptions)
        options.headers['Content-Length'] = Buffer.byteLength(postOptionsString)
      }
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
            const { document } = new JSDOM(res.body).window
            const responseViewStateEl = document.querySelector("input[name='javax.faces.ViewState']")
            if (responseViewStateEl) {
              var responseViewState = responseViewStateEl.value
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
              viewState: responseViewState
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

      if (options.method === 'POST') req.write(postOptionsString)
      req.end()
    })
  }

  _removeTagsHtml (text) {
    try {
      return text
        .replace(/\n|\t/gm, ' ')
        .replace(/<p>|<br\/>|<br>/gm, '\n')
        .replace(/<script([\S\s]*?)>([\S\s]*?)<\/script>|&nbsp;|<style([\S\s]*?)style>|<([\S\s]*?)>|<[^>]+>| +(?= )|\t/gm,
          '')
        .trim()
    } catch (err) {
      return ''
    }
  }

  _extractJSFCLJS (javaScriptCode, htmlBody) {
    const { document } = new JSDOM(htmlBody).window

    if (javaScriptCode.includes('getElementById')) {
      const formQuery = javaScriptCode.replace(
        /if([\S\s]*?)getElementById\('|'([\S\s]*?)false/gm,
        ''
      )
      const formEl = document.getElementById(formQuery)
      if (!formEl) {
        throw new Error('FORM_NOT_FOUND')
      }
      const postOptionsString =
      '{' +
      javaScriptCode
        .replace(/if([\S\s]*?),{|},([\S\s]*?)false/gm, '')
        .replace(/"/gm, '"')
        .replace(/'/gm, '"') +
      '}'
      const postOptions = JSON.parse(postOptionsString)
      const form = this._extractForm(formEl, { submitInput: false })
      for (const postOption of Object.entries(postOptions)) {
        form.postOptions[postOption[0]] = postOption[1]
      }
      return form
    } else if (javaScriptCode.includes('document.forms')) {
      const formQuery = javaScriptCode.replace(
        /if([\S\s]*?)forms\['|'([\S\s]*?)false/gm,
        ''
      )
      const formEl = document.forms[formQuery]
      if (!formEl) {
        throw new Error('FORM_NOT_FOUND')
      }
      const postOptions = javaScriptCode
        .replace(/if([\S\s]*?),'|'([\S\s]*?)false/gm, '')
        .split(',')

      const form = this._extractForm(formEl, { submitInput: false })
      for (let i = 0; i < postOptions.length; i = i + 2) {
        form.postOptions[postOptions[i]] = postOptions[i + 1]
      }
      return form
    }
  }

  _extractForm (formEl, options) {
    if (!formEl) {
      throw new Error('FORM_NOT_FOUND')
    }
    let query
    if (options) {
      if (options.submitInput) {
        query = 'input[name]'
      } else {
        query = "input[name]:not([type='submit'])"
      }
    } else {
      query = 'input[name]'
    }

    var inputs = formEl.querySelectorAll(query)

    const form = {}
    form.action = new URL(formEl.action, this._sigaaSession.urlBase).href
    form.method = formEl.method
    form.postOptions = {}
    for (const input of inputs) {
      form.postOptions[input.name] = input.value
    }
    return form
  }

  async followAllRedirect (res) {
    while (res.headers.location) {
      res = await this._get(res.headers.location)
    }
    return res
  }
}
module.exports = sigaaBase
