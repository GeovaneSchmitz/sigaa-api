const SigaaBase = require('../common/sigaa-base')
const SigaaErrors = require('../common/sigaa-errors')
const Cheerio = require('cheerio')

class SigaaWebContent extends SigaaBase {
  constructor(options, updateAttachment, sigaaSession) {
    super(sigaaSession)
    this.update(options)
    if (updateAttachment !== undefined) {
      this._updateWebContent = updateAttachment
    } else {
      throw new Error(SigaaErrors.SIGAA_WEBCONTENT_UPDATE_IS_NECESSARY)
    }
  }

  get type() {
    return 'webcontent'
  }

  update(options) {
    if (options.title !== undefined && options.form !== undefined) {
      this._title = options.title
      this._form = options.form
      this._close = false
    } else {
      throw new Error(SigaaErrors.SIGAA_INVALID_WEBCONTENT_OPTIONS)
    }
  }

  async getDate() {
    if (!this._date) {
      await this._loadWebContentPage()
    }
    return this._date
  }

  get title() {
    this._checkIfItWasClosed()
    return this._title
  }

  get description() {
    if (this._description) {
      return this._description
    } else {
      return ''
    }
  }
  async getContent() {
    if (!this._content) {
      await this._loadWebContentPage()
    }
    return this._content
  }
  async _loadWebContentPage() {
    this._checkIfItWasClosed()
    try {
      const page = await this._post(this._form.action, this._form.postValues)
      if (page.statusCode === 200) {
        const $ = Cheerio.load(page.body, {
          normalizeWhitespace: true
        })
        const rows = $('table.formAva tr').toArray()
        for (const row of rows) {
          const rowLabel = this._removeTagsHtml(
            $(row)
              .find('th')
              .html()
          )
          const rowContent = this._removeTagsHtml(
            $(row)
              .find('td')
              .html()
          )
          switch (rowLabel) {
            case 'Título:': {
              this._title = rowContent
              break
            }
            case 'Conteúdo:': {
              this._content = rowContent
              break
            }
            case 'Data Cadastro:': {
              const date = this._parseDates(rowContent)
              if (date && date[0]) {
                this._date = date[0]
              }
              break
            }
          }
        }
        return this._description
      } else if (page.statusCode === 302) {
        throw new Error(SigaaErrors.SIGAA_WEBCONTENT_EXPIRED)
      } else {
        throw new Error(SigaaErrors.SIGAA_UNEXPECTED_RESPONSE)
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

  get id() {
    this._checkIfItWasClosed()
    return this._form.postValues.id
  }

  close() {
    this._close = true
  }

  _checkIfItWasClosed() {
    if (this._close) {
      throw new Error(SigaaErrors.SIGAA_WEBCONTENT_HAS_BEEN_FINISHED)
    }
  }
}

module.exports = SigaaWebContent
