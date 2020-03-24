const SigaaBase = require('../common/sigaa-base')
const SigaaErrors = require('../common/sigaa-errors')

class SigaaClassScheduledStudent extends SigaaBase {
  constructor(chatOptions, chatUpdate, sigaaSession) {
    super(sigaaSession)
    this.update(chatOptions)
    if (chatUpdate !== undefined) {
      this._updateChat = chatUpdate
    } else {
      throw new Error(SigaaErrors.SIGAA_SCHEDULED_CHAT_UPDATE_IS_NECESSARY)
    }
  }

  update(chatOptions) {
    if (
      chatOptions.title !== undefined &&
      chatOptions.id !== undefined &&
      chatOptions.startDate !== undefined &&
      chatOptions.endDate !== undefined
    ) {
      this._title = chatOptions.title
      this._id = chatOptions.id
      this._startDate = chatOptions.startDate
      this._endDate = chatOptions.endDate
      if (chatOptions.description !== undefined) {
        this._description = chatOptions.description
      }
    } else {
      throw new Error(SigaaErrors.SIGAA_INVALID_SCHEDULED_CHAT_OPTIONS)
    }
  }

  get title() {
    this._checkIfItWasClosed()
    return this._title
  }

  get id() {
    this._checkIfItWasClosed()
    return this._id
  }

  async getDescription() {
    if (this._description === undefined) {
      await this._updateChat()
    }
    return this._description
  }

  get startDate() {
    this._checkIfItWasClosed()
    return this._startDate
  }

  get endDate() {
    this._checkIfItWasClosed()
    return this._endDate
  }

  get type() {
    return 'scheduled-chat'
  }

  _checkIfItWasClosed() {
    if (this._close) {
      throw new Error(SigaaErrors.SIGAA_SCHEDULED_CHAT_HAS_BEEN_FINISHED)
    }
  }

  close() {
    this._close = true
  }
}

module.exports = SigaaClassScheduledStudent
