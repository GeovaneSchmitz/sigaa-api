
class SigaaTopic {
  constructor (options) {
    if (options.title !== undefined &&
      options.contentText !== undefined &&
      options.attachments !== undefined &&
      options.startTimestamp !== undefined &&
      options.endTimestamp !== undefined &&
      options.attachments !== undefined) {
      this._title = options.title
      this._contextText = options.contentText
      this._startTimestamp = options.startTimestamp
      this._endTimestamp = options.endTimestamp
      this._attachments = options.attachments
      this._finish = false
    } else {
      throw new Error('INVALID_TOPIC')
    }
  }

  get title () {
    this._checkIfItWasFinalized()
    return this._title
  }

  get contentText () {
    this._checkIfItWasFinalized()
    return this._contextText
  }

  get endTimestamp () {
    this._checkIfItWasFinalized()
    return this._endTimestamp
  }

  get startTimestamp () {
    this._checkIfItWasFinalized()
    return this._startTimestamp
  }

  get attachments () {
    this._checkIfItWasFinalized()
    return this._attachments
  }

  finish () {
    this._finish = true
  }

  _checkIfItWasFinalized () {
    if (this._finish) {
      throw new Error('TOPIC_HAS_BEEN_FINISHED')
    }
  }
}

module.exports = SigaaTopic
