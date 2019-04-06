const https = require ('https');
const querystring = require ('querystring');
const {JSDOM} = require ('jsdom');

('use strict');
class sigaaRequest {
  constructor (cache) {
    if (cache) {
      this._cache = cache;
      this._cacheStatus = true;
    } else {
      this._cacheStatus = false;
    }
    this.urlBase = 'https://sigaa.ifsc.edu.br';
  }
  _basicOptions (method, link,token) {
    const basicOptions = {
      hostname: link.hostname,
      port: 443,
      path: link.pathname + link.search,
      method: method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:64.0) Gecko/20100101 Firefox/64.0',
      },
    };
    let options = Object.assign ({}, basicOptions);
    if (method == 'POST') {
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    if (token) {
      options.headers.Cookie = token;
    }
    return options;
  }
  post (path, postOptions, token, params) {
   
    let link = new URL (path, this.urlBase);

    let options = this._basicOptions ('POST', link, token);

    let postOptionsString = querystring.stringify (postOptions);
    options.headers['Content-Length'] = Buffer.byteLength (postOptionsString);
    return new Promise ((resolve, reject) => {
      if (this._cacheStatus && !(params && params.noCache === true)) {
        var cachePage = this._cache.get (
          'POST',
          link.href,
          options.headers,
          postOptions
        );
      }
      if (cachePage) {
        cachePage.token = token;
        resolve (cachePage);
      } else {
        resolve (this._request (link, options, token, postOptionsString));
      }
    });
  }
  get (path, token, params) {
    let link = new URL (path, this.urlBase);

    let options = this._basicOptions ('GET', link, token);

    return new Promise ((resolve) => {
      if (this._cacheStatus  && !(params && params.noCache === true)) {
        var cachePage = this._cache.get (
          'GET',
          link.href,
          options.headers
        );
      }
      if (cachePage) {
        cachePage.token = token;
        resolve (cachePage);
      } else {
        resolve (this._request (link, options, token));
      }
    });
  }
  _request (link, options, token, postOptionsString) {
    return new Promise ((resolve, reject) => {
      const req = https.request (options, res => {
        res.setEncoding ('utf8');
        res.url = link;
        if (res.headers['set-cookie']) {
          let cookies = res.headers['set-cookie'];
          res.token = cookies[cookies.length - 1].split (';')[0];
        } else if (token) {
          res.token = token;
        }
        if (Array.isArray (res.headers.location)) {
          res.headers.location = res.headers.location[0];
        }

        res.body = '';
        res.on ('data', chunk => {
          res.body = res.body + chunk;
        });

        res.on ('end', () => {
          if (this._cacheStatus && res.statusCode == 200){
            this._cache.store(options.method, {
              url:link,
              requestHeaders:options.headers,
              responseHeaders:res.headers,
              body:res.body
            });
          }
          resolve (res);
        });

      });

      req.on ('error', e => {
        let response = {
          status: 'ERROR',
          errorCode: e.code,
          error: e,
        };
        reject (response);
      });

      if(options.method == 'POST') req.write (postOptionsString);
      req.end ();
    });
  }
  extractForm (res, formName, options) {
    if (options) {
      if (options.submitInput) {
        var query = 'input[name]';
      } else {
        var query = "input[name]:not([type='submit'])";
      }
    } else {
      var query = 'input[name]';
    }

    let {document} = new JSDOM (res.body).window;
    let formEl = document.forms[formName];
    if (formEl) {
      var inputs = formEl.querySelectorAll (query);
    } else {
      throw 'FORM_NOT_FOUND';
    }
    let form = {}
    form.action = formEl.action;
    form.method = formEl.method;
    form.postOptions = {};
    for (let input of inputs) {
      form.postOptions[input.name] = input.value;
    }
    return form;
  }
  async followAllRedirect (res) {
    while (res.headers.location) {
      res = await this.get (res.headers.location, res.token);
    }
    return res;
  }
}
module.exports = sigaaRequest;
