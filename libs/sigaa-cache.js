'use strict'

class SiggaCache {
    constructor(timeout){
        this._cachePages ={
            get:[],
            post:[]
        }
        if(timeout){
            this.timeout = timeout;
        }else{
            this.timeout = 5 * 60 // 5min 
        }
        setTimeout(() => {
            for(let [cachePage, i] of this._cachePages.get.entries()){
                if(cachePage.createAt < Date.now() - timeout){
                    this._cachePages.get.splice(i,1)
                }
            }
            for(let [cachePage, i] of this._cachePages.post.entries()){
                if(cachePage.createAt < Date.now() - timeout){
                    this._cachePages.post.splice(i,1)
                }
            }
        }, 15000);
    }

    get timeout(){
        return this._timeout
    }
    set timeout(timeout){
        this._timeout = timeout
    }
    _storeGet(url, requestHeaders, responseHeaders, body){
        let page = {
            url: url.href,
            requestHeaders,
            headers:responseHeaders,
            body,
            createAt: Date.now()
        }

        var replace = false;     
        for(let [cachePage, i] of this._cachePages.get.entries()){
            if(cachePage.url == page.url && cachePage.headers == page.headers){
                this._cachePages.get[i] = page;
                replace = true;
                break;
            }
        }
        if(!replace){
            this._cachePages.get.push(page)
        }

    }

    _storePost(url, postOptions, requestHeaders, responseHeaders, body){

        let page = {
            url: url.href,
            postOptions,
            requestHeaders,
            headers:responseHeaders,
            body,
            createAt: Date.now()
        }

        var replace = false;     
        for(let [cachePage, i] of this._cachePages.post.entries()){
            if(cachePage.url == page.url && cachePage.headers == page.headers){
                this._cachePages.post[i] = page;
                replace = true;
                break;
            }
        }
        if(!replace){
            this._cachePages.post.push(page)
        }

    }
    store(method, params){
        if(method == 'GET'){
            this._storeGet(params.url, params.requestHeaders, params.responseHeaders, params.body)
        }else if(method == 'POST'){
            this._storePost(params.url, params.postOptions, params.requestHeaders, params.responseHeaders, params.body)
        }
    }
    get(method, url, headers, postOptions){
        if(method == 'POST'){
            for(let cachePage of this._cachePages.get){
                if(cachePage.url == url &&  JSON.stringify(cachePage.requestHeaders) ==  JSON.stringify(headers)){
                    cachePage.url = new URL(cachePage.url);
                    cachePage.statusCode = 200;
                    return cachePage
                }
            }
        }else if(method == 'POST'){

            for(let cachePage of this._cachePages.get){
                if(cachePage.url == url && JSON.stringify(cachePage.requestHeaders) == JSON.stringify(headers) &&  JSON.stringify(cachePage.postOptions) ==  JSON.stringify(postOptions)){
                    cachePage.url = new URL(cachePage.url);
                    cachePage.statusCode = 200;
                    return cachePage
                }
            }
        }

        return false
    }
}
module.exports = SiggaCache;