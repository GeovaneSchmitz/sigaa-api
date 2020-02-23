const SigaaBase = require('../common/sigaa-base')
const Cheerio = require('cheerio')

class SigaaNews extends SigaaBase {
  constructor(newsOptions, newsUpdate, sigaaSession) {
    super(sigaaSession)
    this.update(newsOptions)
    if (newsUpdate !== undefined) {
      this._updateNews = newsUpdate
    } else {
      throw new Error('NEWS_UPDATE_IS_NECESSARY')
    }
  }

  update(newsOptions) {
    if (newsOptions.title !== undefined && newsOptions.form !== undefined) {
      this._title = newsOptions.title
      this._form = newsOptions.form
    } else {
      throw new Error('INVALID_NEWS_OPTIONS')
    }
  }

  get title() {
    this._checkIfItWasClosed()
    return this._title
  }

  async getContent() {
    this._checkIfItWasClosed()
    if (this._content === undefined) {
      await this._getFullNews()
    }
    return this._content
  }

  _checkIfItWasClosed() {
    if (this._close) {
      throw new Error('NEWS_HAS_BEEN_FINISHED')
    }
  }

  async getDate() {
    this._checkIfItWasClosed()
    if (this._date === undefined) {
      await this._getFullNews()
    }
    return this._date
  }

  close() {
    this._close = true
  }

  get id() {
    this._checkIfItWasClosed()
    return this._form.postValues.id
  }

  async _getFullNews(retry = true) {
    try {
      const page = await this._post(this._form.action, this._form.postValues)
      if (page.statusCode !== 200) {
        throw new Error('SIGAA_UNEXPECTED_RESPONSE')
      }
      const $ = Cheerio.load(page.body, {
        normalizeWhitespace: true
      })
      const newsElement = $('ul.form')
      if (newsElement.length === 0) throw new Error('NEWS_ELEMENT_NOT_FOUND')
      const els = newsElement.find('span')
      const dateString = this._removeTagsHtml(els.eq(1).html())
      this._date = this._parseDates(dateString)[0]
      this._content = this._removeTagsHtml(newsElement.find('div').html())
    } catch (err) {
      if (retry) {
        await this._updateNews()
        return this._getFullNews(false)
      } else {
        throw new Error('SIGAA_UNEXPECTED_RESPONSE')
      }
    }
  }
}

module.exports = SigaaNews
