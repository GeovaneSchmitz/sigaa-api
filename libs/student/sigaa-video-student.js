const SigaaBase = require('../common/sigaa-session')

class SigaaVideo extends SigaaBase {
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
    return 'video'
  }

  update (options) {
    if (options.title !== undefined &&
        options.src !== undefined) {
      this._title = options.title
      this._src = options.src
      this._finish = false
      if (this._awaitUpdate) {
        this._awaitUpdate.bind(this)()
      }
    } else {
      throw new Error('INVALID_VIDEO_OPTIONS')
    }
  }

  get title () {
    this._checkIfItWasFinalized()
    return this._title
  }

  get src () {
    this._checkIfItWasFinalized()
    return this._src
  }

  finish () {
    this._finish = true
  }

  _checkIfItWasFinalized () {
    if (this._finish) {
      throw new Error('VIDEO_HAS_BEEN_FINISHED')
    }
  }
}

module.exports = SigaaVideo
