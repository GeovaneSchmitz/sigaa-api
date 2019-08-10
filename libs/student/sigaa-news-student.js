const SigaaBase = require('../common/sigaa-base')
const { JSDOM } = require('jsdom')

class SigaaNews extends SigaaBase {
  constructor (newsParams, newsUpdate, sigaaSession) {
    super(sigaaSession)
    this.update(newsParams)
    if (newsUpdate !== undefined) {
      this._callUpdate = newsUpdate
    } else {
      throw new Error('NEWS_UPDATE_IS_NECESSARY')
    }
  }

  update (newsParams) {
    if (newsParams.title !== undefined &&
      newsParams.date !== undefined &&
      newsParams.form !== undefined) {
      this._title = newsParams.title
      this._date = newsParams.date
      this._form = newsParams.form
    } else {
      throw new Error('INVALID_NEWS_OPTIONS')
    }
    if (this._awaitUpdate) {
      this._awaitUpdate()
    }
  }

  get date () {
    this._checkIfItWasFinalized()
    return this._date
  }

  get title () {
    this._checkIfItWasFinalized()
    return this._title
  }

  getContent () {
    return new Promise((resolve) => {
      this._checkIfItWasFinalized()
      if (this._content === undefined) {
        resolve(this._getFullNews()
          .then(() => new Promise(resolve => {
            resolve(this._content)
          })))
      } else {
        resolve(this._content)
      }
    })
  }

  _checkIfItWasFinalized () {
    if (this._finish) {
      throw new Error('NEWS_HAS_BEEN_FINISHED')
    }
  }

  getTime () {
    return new Promise((resolve) => {
      this._checkIfItWasFinalized()
      if (this._time === undefined) {
        resolve(this._getFullNews()
          .then(() => new Promise(resolve => {
            resolve(this._time)
          })))
      } else {
        resolve(this._time)
      }
    })
  }

  finish () {
    this._finish = true
  }

  get id () {
    this._checkIfItWasFinalized()
    return this._form.postOptions.id
  }

  _getFullNews (retry = true) {
    return this._post(this._form.action, this._form.postOptions)
      .then(res => {
        return new Promise((resolve, reject) => {
          switch (res.statusCode) {
            case 200:
              var { document } = new JSDOM(res.body).window
              var newsElement = document.querySelector('ul.form')
              if (!newsElement) reject(new Error('NEWS_ELEMENT_NOT_FOUND'))
              var els = newsElement.querySelectorAll('span')
              this._time = this._removeTagsHtml(els[1].innerHTML).split(' ')[1]
              this._content = this._removeTagsHtml(newsElement.querySelector('div').innerHTML)
              resolve()
              break
            default:
              if (retry) {
                this._awaitUpdate = () => {
                  this._awaitUpdate = undefined
                  resolve(this._getFullNews(false))
                }
                this._callUpdate()
              } else {
                reject(new Error(`SIGAA_STATECODE_${res.statusCode}`))
              }
          }
        })
      })
  }
}

module.exports = SigaaNews
