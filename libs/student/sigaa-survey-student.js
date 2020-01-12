const SigaaBase = require('../common/sigaa-base')

class SigaaSurvey extends SigaaBase {
  constructor (options, updateAttachment, sigaaSession) {
    super(sigaaSession)
    this.update(options)
    if (updateAttachment !== undefined) {
      this._updateAttachment = updateAttachment
    } else {
      throw new Error('ATTACHMENTUPDATE_IS_NECESSARY')
    }
  }

  get type () {
    return 'survey'
  }

  update (options) {
    if (options.title !== undefined &&
            options.description !== undefined &&
            options.form !== undefined) {
      this._title = options.title
      this._description = options.description
      this._form = options.form
      this._finish = false
      if (this._awaitUpdate) {
        this._awaitUpdate.bind(this)()
      }
    } else {
      throw new Error('INVALID_SURVEY_OPTIONS')
    }
  }

  get title () {
    this._checkIfItWasFinalized()
    return this._title
  }

  get description () {
    this._checkIfItWasFinalized()
    return this._description
  }

  get id () {
    this._checkIfItWasFinalized()
    return this._form.postValues.id
  }

  finish () {
    this._finish = true
  }

  _checkIfItWasFinalized () {
    if (this._finish) {
      throw new Error('SURVEY_HAS_BEEN_FINISHED')
    }
  }
}

module.exports = SigaaSurvey
