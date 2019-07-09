const SigaaBase = require('./sigaa-base');
const { JSDOM } = require('jsdom');

('use strict');

class SigaaNews extends SigaaBase {
  constructor(newsParams, newsUpdate, sigaaData) {
    super(sigaaData);
    this.update(newsParams);
    if(newsUpdate != undefined)
      this._callUpdate = newsUpdate;
    else
      throw "NEWS_UPDATE_IS_NECESSARY";
  }
  update(newsParams) {
    if (newsParams.name != undefined &&
      newsParams.date != undefined &&
      newsParams.form != undefined) {
      this._name = newsParams.name;
      this._date = newsParams.date;
      this._form = newsParams.form;
    }
    else {
      throw "INVALID_NEWS_OPTIONS";
    }
    if(this._awaitUpdate){
      this._awaitUpdate()
    }
  }

  get date() {
    this._checkIfItWasFinalized()
    return this._date
  }
  get name() {
    this._checkIfItWasFinalized()
    return this._name
  }
  getContent() {
    return new Promise((resolve) => {
      this._checkIfItWasFinalized()
      if (this._content == undefined) {
        resolve(this._getFullNews()
          .then(() => new Promise(resolve => {
            resolve(this._content);
          })))
      } else {
        resolve(this._content)
      }
    })
  }
  _checkIfItWasFinalized() {
    if (this._finish) {
      throw "NEWS_HAS_BEEN_FINISHED"
    }
  } 
  getTime() {
    return new Promise((resolve) => {
      this._checkIfItWasFinalized()
      if (this._time == undefined) {
        resolve(this._getFullNews()
          .then(() => new Promise(res => {
            res(this._time);
          })))
      } else {
        resolve(this._time)
      }
    })
  }
  finish(){
    this._finish = true;
  }
  get id(){
    this._checkIfItWasFinalized()
    return this._form.postOptions.id
  }
  _getFullNews(retry = true) {
    return this._post(this._form.action, this._form.postOptions, this._data.token)
      .then(res => {
        return new Promise((resolve, reject) => {
          switch (res.statusCode) {
            case 200:
              let { document } = new JSDOM(res.body).window;
              let newsEl = document.querySelector("ul.form");
              if (!newsEl)
                reject({ status: "ERROR", errorCode: "UNKNOWN" });
              let els = newsEl.querySelectorAll("span");
              this._time = this._removeTagsHtml(els[1].innerHTML).split(' ')[1];
              this._content = this._removeTagsHtml(newsEl.querySelector("div").innerHTML);
              resolve();
              break;
            default: 
              if(retry){
                this._awaitUpdate = () => {
                  this._awaitUpdate = undefined;
                  resolve(this._getFullNews(false))
                }
                this._callUpdate()
                             
              }else{
                reject({ status: "ERROR", errorCode: res.statusCode });

              }
            }

        });
      });
  }
}

module.exports = SigaaNews;
