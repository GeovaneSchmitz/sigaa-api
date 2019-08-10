const SigaaBase = require('../common/sigaa-base')

class SigaaHomework extends SigaaBase {
  constructor (options, homeworkUpdate, sigaaSession) {
    super(sigaaSession)
    this.update(options)
    if (homeworkUpdate !== undefined) {
      this._homeworkUpdate = homeworkUpdate
    } else {
      throw new Error('HOMEWORK_UPDATE_IS_NECESSARY')
    }
  }

  get type () {
    return 'homework'
  }

  update (options) {
    if (options.title !== undefined &&
      options.startTimestamp !== undefined &&
      options.id !== undefined &&
      options.endTimestamp !== undefined) {
      this._title = options.title
      this._startTimestamp = options.startTimestamp
      this._endTimestamp = options.endTimestamp
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

  get title () {
    this._checkIfItWasFinalized()
    return this._title
  }

  getHaveGrade () {
    return new Promise(resolve => {
      if (this._haveGrade !== undefined) {
        resolve(this._haveGrade)
      } else {
        return this._homeworkUpdate()
          .then(() => {
            resolve(this._haveGrade)
          })
      }
    })
  }

  getDescription () {
    return new Promise(resolve => {
      if (this._description !== undefined) {
        resolve(this._description)
      } else {
        return this._homeworkUpdate()
          .then(() => {
            resolve(this._description)
          })
      }
    })
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
    return this._id
  }

  finish () {
    this._finish = true
  }

  _checkIfItWasFinalized () {
    if (this._finish) {
      throw new Error('HOMEWORK_HAS_BEEN_FINISHED')
    }
  }
}

module.exports = SigaaHomework
