const SigaaBase = require('../common/sigaa-base')
const SigaaErrors = require('../common/sigaa-errors')

class SigaaSurvey extends SigaaBase {
  constructor(options, updateAttachment, sigaaSession) {
    super(sigaaSession)
    this.update(options)
    if (updateAttachment !== undefined) {
      this._updateAttachment = updateAttachment
    } else {
      throw new Error(SigaaErrors.SIGAA_SURVEY_UPDATE_IS_NECESSARY)
    }
  }

  get type() {
    return 'survey'
  }

  update(options) {
    if (
      options.title !== undefined &&
      options.description !== undefined &&
      options.form !== undefined
    ) {
      this._title = options.title
      this._description = options.description
      this._form = options.form
      this._close = false
      if (this._awaitUpdate) {
        this._awaitUpdate.bind(this)()
      }
    } else {
      throw new Error(SigaaErrors.SIGAA_INVALID_SURVEY_OPTIONS)
    }
  }

  get title() {
    this._checkIfItWasClosed()
    return this._title
  }

  get description() {
    this._checkIfItWasClosed()
    return this._description
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
      throw new Error(SigaaErrors.SIGAA_SURVEY_HAS_BEEN_FINISHED)
    }
  }
}

module.exports = SigaaSurvey
