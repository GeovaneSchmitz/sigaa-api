const Cheerio = require('cheerio')

const SigaaBase = require('../common/sigaa-base')
const SigaaErrors = require('../common/sigaa-errors')

class SigaaSearchTeacherResult extends SigaaBase {
  constructor(options, sigaaSession) {
    super(sigaaSession)
    if (
      options.name !== undefined &&
      options.department !== undefined &&
      options.pageURL !== undefined &&
      options.photoURL !== undefined
    ) {
      this._name = options.name
      this._department = options.department
      this._pageURL = options.pageURL
      this._photoURL = options.photoURL
    } else {
      throw new Error(SigaaErrors.SIGAA_INVALID_TEACHER_OPTIONS)
    }
  }

  async getEmail() {
    const page = await this._get(this.pageURL).then((page) =>
      this._checkPageStatusCodeAndExpired(page)
    )
    const $ = Cheerio.load(page.body)
    const contactElements = $('#contato')
      .children()
      .toArray()
    let email
    for (const contactElement of contactElements) {
      const name = this._removeTagsHtml(
        $(contactElement)
          .find('dt')
          .html()
      )
      if (name === 'Endereço eletrônico') {
        email = this._removeTagsHtml(
          $(contactElement)
            .find('dd')
            .html()
        )
        break
      }
    }
    if (email && email !== 'não informado') {
      return email
    } else {
      return null
    }
  }

  get name() {
    return this._name
  }

  get photoURL() {
    return this._photoURL
  }

  get department() {
    return this._department
  }

  get pageURL() {
    return this._pageURL
  }
}

module.exports = SigaaSearchTeacherResult
