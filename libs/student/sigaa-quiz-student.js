const SigaaBase = require('../common/sigaa-base')

class SigaaQuiz extends SigaaBase {
  constructor(options, updateQuiz, sigaaSession) {
    super(sigaaSession)
    this.update(options)
    if (updateQuiz !== undefined) {
      this._updateQuiz = updateQuiz
    } else {
      throw new Error('QUIZ_UPDATEQUIZ_IS_NECESSARY')
    }
  }

  get type() {
    return 'quiz'
  }

  update(options) {
    if (
      options.title !== undefined &&
      options.startDate !== undefined &&
      options.endDate !== undefined &&
      options.id !== undefined
    ) {
      this._title = options.title
      this._id = options.id
      this._startDate = options.startDate
      this._endDate = options.endDate
      this._finish = false
      this._formSendAnswers = options.formSendAnswers
      this._formViewAnswersSubmitted = options.formViewAnswersSubmitted
    } else {
      throw new Error('INVALID_QUIZ_OPTIONS')
    }
  }

  get title() {
    this._checkIfItWasFinalized()
    return this._title
  }

  get endDate() {
    this._checkIfItWasFinalized()
    return this._endDate
  }

  getAnswersSubmitted(retry = true) {
    return new Promise((resolve, reject) => {
      try {
        if (this._formSendAnswers !== undefined) {
          throw new Error('QUIZ_YET_NO_SENT_ANSWERS')
        }
        if (this._formViewAnswersSubmitted === undefined) {
          throw new Error('QUIZ_FORM_IS_UNDEFINED')
        }
        this._post(
          this._formViewAnswersSubmitted.action,
          this._formViewAnswersSubmitted.postValues
        ).then((page) => {
          switch (page.statusCode) {
            case 200:
              if (
                page.body.includes(
                  'Acabou o prazo para visualizar as respostas.'
                )
              ) {
                reject(new Error('QUIZ_DEADLINE_TO_READ_ANSWERS'))
              }
              reject(new Error('QUIZ_TODO'))
              break
            case 302:
              reject(new Error('QUIZ_EXPIRED'))
              break
            default:
              reject(new Error(`SIGAA_UNEXPECTED_RESPONSE`))
          }
        })
      } catch (err) {
        if (
          err.message === 'QUIZ_DEADLINE_TO_READ_ANSWERS' ||
          err.message === 'QUIZ_YET_NO_SENT_ANSWERS'
        ) {
          reject(err)
        }
        if (retry) {
          resolve(this._updateQuiz().then(this.getAnswersSubmitted(false)))
        } else {
          reject(err)
        }
      }
    })
  }

  get startDate() {
    this._checkIfItWasFinalized()
    return this._startDate
  }

  get id() {
    this._checkIfItWasFinalized()
    return this._id
  }

  finish() {
    this._finish = true
  }

  _checkIfItWasFinalized() {
    if (this._finish) {
      throw new Error('QUIZ_HAS_BEEN_FINISHED')
    }
  }
}

module.exports = SigaaQuiz
