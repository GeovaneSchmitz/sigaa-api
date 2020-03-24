const SigaaAccount = require('./libs/common/sigaa-account')
const SigaaBase = require('./libs/common/sigaa-base')
const SigaaErrors = require('./libs/common/sigaa-errors')
const SigaaLogin = require('./libs/common/sigaa-login')
const SigaaSession = require('./libs/common/sigaa-session')
const SigaaTypes = require('./libs/common/sigaa-types')

const SigaaAccountStudent = require('./libs/student/sigaa-account-student')
const SigaaClassStudent = require('./libs/student/sigaa-class-student')
const SigaaFileStudent = require('./libs/student/sigaa-file-student')
const SigaaClassForum = require('./libs/student/sigaa-class-forum-student')
const SigaaHomeworkStudent = require('./libs/student/sigaa-homework-student')
const SigaaNewsStudent = require('./libs/student/sigaa-news-student')
const SigaaQuizStudent = require('./libs/student/sigaa-quiz-student')
const SigaaSurveyStudent = require('./libs/student/sigaa-survey-student')
const SigaaTopicStudent = require('./libs/student/sigaa-topic-student')
const SigaaWebContentStudent = require('./libs/student/sigaa-web-content-student')

const SigaaSearch = require('./libs/public/sigaa-search')
const SigaaSearchTeacher = require('./libs/public/sigaa-search-teacher')
const SigaaSearchTeacherResult = require('./libs/public/sigaa-search-teacher-result')

/**
 * @class Sigaa
 */
class Sigaa {
  constructor(options) {
    if (options) {
      if (options.sessionJSON) {
        this._sigaaSession = new SigaaSession()
        this._sigaaSession.parseJSON(options.sessionJSON)
        this._sigaaLogin = new SigaaLogin(this._sigaaSession)
      } else if (options.url) {
        this._sigaaSession = new SigaaSession()
        this._sigaaLogin = new SigaaLogin(this._sigaaSession)
        this._sigaaSession.url = options.url
      } else {
        throw new Error(SigaaErrors.SIGAA_URL_IS_NECESSARY)
      }
    } else {
      throw new Error(SigaaErrors.SIGAA_OPTIONS_IS_NECESSARY)
    }
  }

  cacheLoginForm() {
    return this._sigaaLogin.cacheLoginForm()
  }

  toJSON() {
    return this._sigaaSession.toJSON()
  }

  /**
   * User authentication
   * @param {String} username
   * @param {String} password
   * @async
   * @returns {Promise<SigaaAccountStudent>}
   */
  async login(username, password) {
    if (
      this._sigaaSession.userLoginState !==
      SigaaTypes.userLoginStates.AUTHENTICATED
    ) {
      await this._sigaaLogin.login(username, password)
    } else {
      throw new Error(SigaaErrors.SIGAA_ALREADY_LOGGED_IN)
    }
    return this.account
  }

  get account() {
    if (
      this._sigaaSession.userLoginState ===
      SigaaTypes.userLoginStates.AUTHENTICATED
    ) {
      if (this._sigaaSession.userType === SigaaTypes.userTypes.STUDENT) {
        return new SigaaAccountStudent(this._sigaaSession)
      } else {
        return new SigaaAccount(this._sigaaSession)
      }
    }
    return null
  }

  get search() {
    return new SigaaSearch(this._sigaaSession)
  }

  /**
   * @readonly
   * @static
   * @type {SigaaAccount}
   */
  static get SigaaAccount() {
    return SigaaAccount
  }

  /**
   * @readonly
   * @static
   * @type {SigaaBase}
   */
  static get SigaaBase() {
    return SigaaBase
  }

  /**
   * @readonly
   * @static
   * @type {SigaaErrors}
   */
  static get SigaaErrors() {
    return SigaaErrors
  }

  /**
   * @readonly
   * @static
   * @type {SigaaLogin}
   */
  static get SigaaLogin() {
    return SigaaLogin
  }

  /**
   * @readonly
   * @static
   * @type {SigaaSession}
   */
  static get SigaaSession() {
    return SigaaSession
  }

  /**
   * @readonly
   * @static
   * @type {SigaaAccountStudent}
   */
  static get SigaaAccountStudent() {
    return SigaaAccountStudent
  }

  /**
   * @readonly
   * @static
   * @type {SigaaClassStudent}
   */
  static get SigaaClassStudent() {
    return SigaaClassStudent
  }

  /**
   * @readonly
   * @static
   * @type {SigaaFileStudent}
   */
  static get SigaaFileStudent() {
    return SigaaFileStudent
  }

  /**
   * @readonly
   * @static
   * @type {SigaaClassForum}
   */
  static get SigaaClassForum() {
    return SigaaClassForum
  }

  /**
   * @readonly
   * @static
   * @type {SigaaHomeworkStudent}
   */
  static get SigaaHomeworkStudent() {
    return SigaaHomeworkStudent
  }

  /**
   * @readonly
   * @static
   * @type {SigaaNewsStudent}
   */
  static get SigaaNewsStudent() {
    return SigaaNewsStudent
  }

  /**
   * @readonly
   * @static
   * @type {SigaaQuizStudent}
   */
  static get SigaaQuizStudent() {
    return SigaaQuizStudent
  }

  /**
   * @readonly
   * @static
   * @type {SigaaSurveyStudent}
   */
  static get SigaaSurveyStudent() {
    return SigaaSurveyStudent
  }

  /**
   * @readonly
   * @static
   * @type {SigaaTopicStudent}
   */
  static get SigaaTopicStudent() {
    return SigaaTopicStudent
  }

  /**
   * @readonly
   * @static
   * @type {SigaaWebContentStudent}
   */
  static get SigaaWebContentStudent() {
    return SigaaWebContentStudent
  }

  /**
   * @readonly
   * @static
   * @type {SigaaSearch}
   */
  static get SigaaSearch() {
    return SigaaSearch
  }

  /**
   * @readonly
   * @static
   * @type {SigaaSearchTeacher}
   */
  static get SigaaSearchTeacher() {
    return SigaaSearchTeacher
  }

  /**
   * @readonly
   * @static
   * @type {SigaaSearchTeacherResult}
   */
  static get SigaaSearchTeacherResult() {
    return SigaaSearchTeacherResult
  }

  /**
   * @enum {Object} Types
   * @readonly
   */
  static get SigaaTypes() {
    return SigaaTypes
  }
}
module.exports = Sigaa
