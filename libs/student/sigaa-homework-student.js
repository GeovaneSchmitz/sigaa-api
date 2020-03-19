const SigaaBase = require('../common/sigaa-base')
const SigaaErrors = require('../common/sigaa-errors')
const SigaaSession = require('../common/sigaa-session')
const SigaaFile = require('./sigaa-file-student')
const Cheerio = require('cheerio')

class SigaaHomework extends SigaaBase {
  /**
   * @param {Object} options
   * @param {String} options.title title of homework
   * @param {String} options.id id of homework
   * @param {Date} options.startDate startDate of homework
   * @param {Date} options.endDate endDate of homework
   * @param {Function} homeworkUpdate Async Function to load the other contents. E.g description, forms, etc. This function should call method update() with the content loaded
   * @param {SigaaSession} sigaaSession
   */
  constructor(options, homeworkUpdate, sigaaSession) {
    super(sigaaSession)
    this.update(options)
    if (homeworkUpdate !== undefined) {
      this._homeworkUpdate = homeworkUpdate
    } else {
      throw new Error(SigaaErrors.SIGAA_HOMEWORK_UPDATE_IS_NECESSARY)
    }
  }

  get type() {
    return 'homework'
  }

  /**
   * Notify instance with new contents.
   * @param {Object} options title of homework
   * @param {String} options.title title of homework
   * @param {String} options.id id of homework
   * @param {Date} options.startDate startDate of homework
   * @param {Date} options.endDate endDate of homework
   * @param {Object} [options.formViewHomeworkSubmitted] formSendHomework
   * @param {String} options.formViewHomeworkSubmitted.action
   * @param {Object} options.formViewHomeworkSubmitted.postValues
   * @param {Object} [options.formSendHomework] formViewHomeworkSubmitted
   * @param {String} options.formSendHomework.action
   * @param {Object} options.formSendHomework.postValues
   * @param {String} [options.description] Description of homework
   * @param {Boolean} [options.haveGrade] If haveGrade
   * @throws {SigaaErrors.SIGAA_INVALID_HOMEWORK_OPTIONS} if Invalid Options
   */
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
      throw new Error(SigaaErrors.SIGAA_INVALID_HOMEWORK_OPTIONS)
    }
  }

  get title() {
    this._checkIfItWasClosed()
    return this._title
  }

  /**
   * @async
   * @readonly
   * @returns {Promise<boolean>} If the have grade property is checked
   */
  async getHaveGrade() {
    if (this._haveGrade === undefined) {
      await this._homeworkUpdate()
    }
    return this._haveGrade
  }

  /**
   * @async
   * @readonly
   * @returns {Promise<String>} The homework description
   */
  async getDescription() {
    if (this._description === undefined) {
      await this._homeworkUpdate()
    }
    return this._description
  }

  /**
   * @returns {Date}
   */
  get endDate() {
    this._checkIfItWasClosed()
    return this._endDate
  }

  /**
   * @returns {Date}
   */
  get startDate() {
    this._checkIfItWasClosed()
    return this._startDate
  }

  /**
   * @returns {String}
   */
  get id() {
    this._checkIfItWasClosed()
    return this._id
  }

  /**
   * Get SigaaFile or throws if you don't have a file
   * @returns {Promise<SigaaFile>}
   * @async
   * @throws {SigaaErrors.SIGAA_HOMEWORK_HAS_BEEN_SUBMITTED} If the homework answer has already been sent
   * @throws {SigaaErrors.SIGAA_HOMEWORK_HAS_NO_FILE} If the homework has no file
   */
  async getAttachmentFile() {
    if (
      this._formSendHomework === undefined &&
      this._formViewHomeworkSubmitted === undefined
    ) {
      await this._homeworkUpdate()
    } else if (this._formSendHomework) {
      const page = await this._post(
        this._formSendHomework.action,
        this._formSendHomework.postValues
      )
      const $ = Cheerio.load(page.body)
      const path = $('ul.form > li > div > a').attr('href')
      if (path) {
        const url = new URL(path, this._sigaaSession.url)
        const file = {
          title: '',
          description: '',
          key: url.searchParams.get('key'),
          id: url.searchParams.get('idArquivo')
        }
        if (!this._file) {
          this._file = new SigaaFile(
            file,
            this.getAttachmentFile.bind(this),
            this._sigaaSession
          )
        } else {
          this._file.update(file)
        }
        return this._file
      } else {
        throw new Error(SigaaErrors.SIGAA_HOMEWORK_HAS_NO_FILE)
      }
    } else {
      throw new Error(SigaaErrors.SIGAA_HOMEWORK_HAS_BEEN_SUBMITTED)
    }
  }

  close() {
    this._close = true
  }

  _checkIfItWasClosed() {
    if (this._finish) {
      throw new Error(SigaaErrors.SIGAA_HOMEWORK_HAS_BEEN_FINISHED)
    }
  }
}

module.exports = SigaaHomework
