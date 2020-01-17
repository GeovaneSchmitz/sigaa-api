const SigaaBase = require('../common/sigaa-base')
const Cheerio = require('cheerio')

class SigaaNews extends SigaaBase {
  constructor(newsParams, newsUpdate, sigaaSession) {
    super(sigaaSession)
    this.update(newsParams)
    if (newsUpdate !== undefined) {
      this._callUpdate = newsUpdate
    } else {
      throw new Error('NEWS_UPDATE_IS_NECESSARY')
    }
  }

  update(newsParams) {
    if (newsParams.title !== undefined && newsParams.form !== undefined) {
      this._title = newsParams.title
      this._form = newsParams.form
    } else {
      throw new Error('INVALID_NEWS_OPTIONS')
    }
    if (this._awaitUpdate) {
      this._awaitUpdate()
    }
  }

  get title() {
    this._checkIfItWasFinalized()
    return this._title
  }

  getContent() {
    return new Promise((resolve) => {
      this._checkIfItWasFinalized()
      if (this._content === undefined) {
        resolve(
          this._getFullNews().then(
            () =>
              new Promise((resolve) => {
                resolve(this._content)
              })
          )
        )
      } else {
        resolve(this._content)
      }
    })
  }

  _checkIfItWasFinalized() {
    if (this._finish) {
      throw new Error('NEWS_HAS_BEEN_FINISHED')
    }
  }

  getDate() {
    return new Promise((resolve) => {
      this._checkIfItWasFinalized()
      if (this._date === undefined) {
        resolve(
          this._getFullNews().then(
            () =>
              new Promise((resolve) => {
                resolve(this._date)
              })
          )
        )
      } else {
        resolve(this._date)
      }
    })
  }

  finish() {
    this._finish = true
  }

  get id() {
    this._checkIfItWasFinalized()
    return this._form.postValues.id
  }

  async _getFullNews(retry = true) {
    const page = await this._post(this._form.action, this._form.postValues)
    if (page.statusCode === 200) {
      const $ = Cheerio.load(page.body, {
        normalizeWhitespace: true
      })
      const newsElement = $('ul.form')
      if (newsElement.length === 0) throw new Error('NEWS_ELEMENT_NOT_FOUND')
      const els = newsElement.find('span')
      const datetime = this._removeTagsHtml(els.eq(1).html()).split(' ')
      const date = datetime[0].split('/')
      const time = datetime[1].split(':')
      const year = parseInt(date[2], 10)
      const monthIndex = parseInt(date[1], 10) - 1
      const day = parseInt(date[0], 10)
      const hours = parseInt(time[0], 10)
      const minutes = parseInt(time[1], 10)
      this._date = new Date(year, monthIndex, day, hours, minutes)
      this._content = this._removeTagsHtml(newsElement.find('div').html())
    } else {
      if (retry) {
        this._awaitUpdate = () => {
          this._awaitUpdate = undefined
          return this._getFullNews(false)
        }
        this._callUpdate()
      } else {
        throw new Error(`SIGAA_STATECODE_${page.statusCode}`)
      }
    }
  }
}

module.exports = SigaaNews
