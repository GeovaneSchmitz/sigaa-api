class SigaaTopic {
  constructor(options) {
    this.update(options)
  }
  update(options) {
    if (
      options.title !== undefined &&
      options.contentText !== undefined &&
      options.attachments !== undefined &&
      options.startDate !== undefined &&
      options.endDate !== undefined
    ) {
      this._title = options.title
      this._contextText = options.contentText
      this._startDate = options.startDate
      this._endDate = options.endDate
      this._attachments = options.attachments
      this._close = false
    } else {
      throw new Error('INVALID_TOPIC')
    }
  }

  get title() {
    this._checkIfItWasClosed()
    return this._title
  }

  get contentText() {
    this._checkIfItWasClosed()
    return this._contextText
  }

  get endDate() {
    this._checkIfItWasClosed()
    return this._endDate
  }

  get startDate() {
    this._checkIfItWasClosed()
    return this._startDate
  }

  get attachments() {
    this._checkIfItWasClosed()
    return this._attachments
  }

  close() {
    this._close = true
  }

  _checkIfItWasClosed() {
    if (this._close) {
      throw new Error('TOPIC_HAS_BEEN_FINISHED')
    }
  }
}

module.exports = SigaaTopic
