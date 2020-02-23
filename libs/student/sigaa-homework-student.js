const SigaaBase = require('../common/sigaa-base')

class SigaaHomework extends SigaaBase {
  constructor(options, homeworkUpdate, sigaaSession) {
    super(sigaaSession)
    this.update(options)
    if (homeworkUpdate !== undefined) {
      this._homeworkUpdate = homeworkUpdate
    } else {
      throw new Error('HOMEWORK_UPDATE_IS_NECESSARY')
    }
  }

  get type() {
    return 'homework'
  }

  update(options) {
    if (
      options.title !== undefined &&
      options.startDate !== undefined &&
      options.id !== undefined &&
      options.endDate !== undefined
    ) {
      this._title = options.title
      this._startDate = options.startDate
      this._endDate = options.endDate
      this._id = options.id
      this._finish = false

      this._formSendHomework = options.formSendHomework
      this._formViewHomeworkSubmitted = options.formViewHomeworkSubmitted
      this._description = options.description
      this._haveGrade = options.haveGrade
    } else {
      throw new Error('INVALID_HOMEWORK_OPTIONS')
    }
  }

  get title() {
    this._checkIfItWasClosed()
    return this._title
  }

  getHaveGrade() {
    return new Promise((resolve) => {
      if (this._haveGrade !== undefined) {
        resolve(this._haveGrade)
      } else {
        return this._homeworkUpdate().then(() => {
          resolve(this._haveGrade)
        })
      }
    })
  }

  getDescription() {
    return new Promise((resolve) => {
      if (this._description !== undefined) {
        resolve(this._description)
      } else {
        return this._homeworkUpdate().then(() => {
          resolve(this._description)
        })
      }
    })
  }

  get endDate() {
    this._checkIfItWasClosed()
    return this._endDate
  }

  get startDate() {
    this._checkIfItWasClosed()
    return this._startDate
  }

  get id() {
    this._checkIfItWasClosed()
    return this._id
  }

  close() {
    this._close = true
  }

  _checkIfItWasClosed() {
    if (this._finish) {
      throw new Error('HOMEWORK_HAS_BEEN_FINISHED')
    }
  }
}

module.exports = SigaaHomework
