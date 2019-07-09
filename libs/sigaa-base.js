const https = require ('https');
const querystring = require ('querystring');
const {JSDOM} = require ('jsdom');

'use strict'

class sigaaBase {
  constructor (sigaaData) {
    if (sigaaData) {
      this._data = sigaaData;
    }else{
      throw "SIGAA_DATA_IS_NECESSARY"
    }
  }
  
  _basicRequestOptions (method, link, token) {
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
  _post (path, postOptions, token, params) {
    let link = new URL (path, this._data.urlBase);

    let options = this._basicRequestOptions ('POST', link, token);

    
    return new Promise ((resolve, reject) => {
      if (!(params && params.noCache === true)) {
        var cachePage = this._data.getPage (
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
        resolve (this._request (link, options, token, postOptions));
      }
    });
  }
  _get (path, token, params) {
    let link = new URL (path, this._data.urlBase);

    let options = this._basicRequestOptions ('GET', link, token);

    return new Promise (resolve => {
      if (!(params && params.noCache === true)) {
        var cachePage = this._data.getPage ('GET', link.href, options.headers);
      }
      if (cachePage) {
        cachePage.token = token;
        resolve (cachePage);
      } else {
        resolve (this._request (link, options, token));
      }
    });
  }
  _request (link, options, token, postOptions) {
    return new Promise ((resolve, reject) => {
      if(postOptions){
        var postOptionsString = querystring.stringify (postOptions);
        options.headers['Content-Length'] = Buffer.byteLength (postOptionsString);
      }
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
          if (res.statusCode == 200) {
            let {document} = new JSDOM (res.body).window;
            let responseViewStateEl = document.querySelector("input[name='javax.faces.ViewState']")
            if(responseViewStateEl){
              var responseViewState = responseViewStateEl.value
            }else{
              responseViewState = false;
            }
            if(postOptions && postOptions['javax.faces.ViewState']){
              this._data.reactivateCachePageByViewState(postOptions['javax.faces.ViewState'])
            }
            this._data.storePage(options.method, {
              url: link,
              requestHeaders: options.headers,
              responseHeaders: res.headers,
              body: res.body,
              viewState: responseViewState
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

      if (options.method == 'POST') req.write (postOptionsString);
      req.end ();
    });
  }
  _removeTagsHtml (string) {
    return string
      .replace(/\n|\t/gm, ' ')
      .replace(/\<p\>|<br\/>|<br>/gm, '\n')
      .replace(/<script([\S\s]*?)>([\S\s]*?)<\/script>|&nbsp;|<style([\S\s]*?)style>|<([\S\s]*?)>|<[^>]+>| +(?= )|\t/gm,
        '')
      .trim ();
  }
  _extractJSFCLJS (javaScriptCode, htmlBody) {
    let {document} = new JSDOM (htmlBody).window;

    if(javaScriptCode.includes("getElementById")){
      let formQuery = javaScriptCode.replace (
        /if([\S\s]*?)getElementById\('|'([\S\s]*?)false/gm,
        ''
      );
      let formEl = document.getElementById(formQuery)
      if(!formEl){
        throw 'FORM_NOT_FOUND';
      }
      let postOptionsString = 
      '{'
      + javaScriptCode
      .replace (/if([\S\s]*?),{|},([\S\s]*?)false/gm, '')
      .replace(/"/gm, '\"')
      .replace(/\'/gm, '"')
      + '}'
      let postOptions = JSON.parse(postOptionsString)
      let form = this._extractForm (formEl, {submitInput: false});
      for (let postOption of Object.entries(postOptions)) {
        form.postOptions[postOption[0]] = postOption[1];
      }
      return form;

    }else if(javaScriptCode.includes("document.forms")){
      let formQuery = javaScriptCode.replace (
        /if([\S\s]*?)forms\['|'([\S\s]*?)false/gm,
        ''
      );
      let formEl = document.forms[formQuery]
      if(!formEl){
        throw 'FORM_NOT_FOUND';
      }
      let postOptions = javaScriptCode
      .replace (/if([\S\s]*?),'|'([\S\s]*?)false/gm, '')
      .split (',');

      let form = this._extractForm (formEl, {submitInput: false});
      for (let i = 0; i < postOptions.length; i = i + 2) {
        form.postOptions[postOptions[i]] = postOptions[i + 1];
      }
      return form;
    }
    
        
   
  }
  _extractForm (formEl, options) {
    if(!formEl){
      throw 'FORM_NOT_FOUND';
    }
    if (options) {
      if (options.submitInput) {
        var query = 'input[name]';
      } else {
        var query = "input[name]:not([type='submit'])";
      }
    } else {
      var query = 'input[name]';
    }

    var inputs = formEl.querySelectorAll (query);

    let form = {};
    form.action = new URL (formEl.action, this._data.urlBase).href;
    form.method = formEl.method;
    form.postOptions = {};
    for (let input of inputs) {
      form.postOptions[input.name] = input.value;
    }
    return form;
  }
  async followAllRedirect (res) {
    while (res.headers.location) {
      res = await this._get (res.headers.location, res.token);
    }
    return res;
  }
}
module.exports = sigaaBase;
