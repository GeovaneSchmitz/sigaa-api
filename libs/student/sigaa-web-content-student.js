const SigaaBase = require('../common/sigaa-session')

class SigaaWebcontent extends SigaaBase {
  constructor (options, updateAttachment, sigaaSession) {
    super(sigaaSession)
    this.update(options)
    if (updateAttachment !== undefined) {
      this._updateAttachment = updateAttachment
    } else {
      throw new Error('WEBCONTENT_UPDATEWEBCONTENT_IS_NECESSARY')
    }
  }

  get type () {
    return 'webcontent'
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
      throw new Error('INVALID_WEBCONTENT_OPTIONS')
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
