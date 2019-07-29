const SigaaBase = require('../common/sigaa-session')

class SigaaQuiz extends SigaaBase {
  constructor (options, updateAttachment, sigaaSession) {
    super(sigaaSession)
    this.update(options)
    if (updateAttachment !== undefined) {
      this._updateAttachment = updateAttachment
    } else {
      throw new Error('QUIZ_UPDATEQUIZ_IS_NECESSARY')
    }
  }

  get type () {
    return 'quiz'
  }

  update (options) {
    if (options.title !== undefined &&
        options.startTimestamp !== undefined &&
        options.endTimestamp !== undefined &&
        options.form !== undefined) {
      this._title = options.title
      this._form = options.form
      this._startTimestamp = options.startTimestamp
      this._endTimestamp = options.endTimestamp
      this._finish = false
      if (this._awaitUpdate) {
        this._awaitUpdate.bind(this)()
      }
    } else {
      throw new Error('INVALID_QUIZ_OPTIONS')
    }
  }

  get title () {
    this._checkIfItWasFinalized()
    return this._title
  }

  get endTimestamp () {
    this._checkIfItWasFinalized()
    return this._endTimestamp
  }

  get startTimestamp () {
    this._checkIfItWasFinalized()
    return this._startTimestamp
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
      throw new Error('QUIZ_HAS_BEEN_FINISHED')
    }
  }
}

module.exports = SigaaQuiz
