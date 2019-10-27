const SigaaBase = require('../common/sigaa-base')
const Cheerio = require('cheerio')

class SigaaWebcontent extends SigaaBase {
  constructor (options, updateAttachment, sigaaSession) {
    super(sigaaSession)
    this.update(options)
    if (updateAttachment !== undefined) {
      this._updateWebContent = updateAttachment
    } else {
      throw new Error('WEBCONTENT_UPDATEWEBCONTENT_IS_NECESSARY')
    }
  }

  get type () {
    return 'webcontent'
  }

  update (options) {
    if (options.title !== undefined &&
        options.form !== undefined) {
      this._title = options.title
      this._date = options.date
      this._form = options.form
      this._finish = false
    } else {
      throw new Error('INVALID_WEBCONTENT_OPTIONS')
    }
  }

  get date () {
    return this._date
  }

  get title () {
    this._checkIfItWasFinalized()
    return this._title
  }

  async getDescription (retry = true) {
    this._checkIfItWasFinalized()
    if (this._description) {
      return this._description
    }
    try {
      const page = await this._post(this._form.action, this._form.postOptions)
      if (page.statusCode === 200) {
        this._sigaaSession.reactivateCachePageByViewState(this._form.postOptions['javax.faces.ViewState'])
        const $ = Cheerio.load(page.body, {
          normalizeWhitespace: true
        })
        const rows = $('table.formAva > tr')
        this._description = this._removeTagsHtml(rows.eq(1).find('td').html())
        return this._description
      } else if (page.statusCode === 302) {
        throw new Error('WEBCONTENT_EXPIRED')
      } else {
        throw new Error(`SIGAA_STATUSCODE_${page.statusCode}`)
      }
    } catch (err) {
      if (retry) {
        await this._updateWebContent()
        return this.getDescription(false)
      } else {
        return err
      }
    }
  }

  get id () {
    this._checkIfItWasFinalized()
    return this._form.postOptions.id
  }

  finish () {
    this._finish = true
  }

  _checkIfItWasFinalized () {
    if (this._finish) {
      throw new Error('WEBCONTENT_HAS_BEEN_FINISHED')
    }
  }
}

module.exports = SigaaWebcontent
