const Cheerio = require('cheerio')

const SigaaBase = require('../common/sigaa-base')

class SigaaSearchTeacherResult extends SigaaBase {
  constructor (params, sigaaSession) {
    super(sigaaSession)
    if (params.name !== undefined &&
      params.department !== undefined &&
      params.pageURL !== undefined &&
      params.photoURL !== undefined) {
      this._name = params.name
      this._department = params.department
      this._pageURL = params.pageURL
      this._photoURL = params.photoURL
    } else {
      throw new Error('INVALID_TEACHER_OPTIONS')
    }
  }

  async getEmail () {
    const page = await this._get(this.pageURL)
      .then(page => this._checkPageStatusCodeAndExpired(page))
    const $ = Cheerio.load(page.body)
    const contactElements = $('#contato').children().toArray()
    let email
    for (const contactElement of contactElements) {
      const name = this._removeTagsHtml($(contactElement).find('dt').html())
      if (name === 'Endereço eletrônico') {
        email = this._removeTagsHtml($(contactElement).find('dd').html())
        break
      }
    }
    if (email && email !== 'não informado') {
      return email
    } else {
      return null
    }
  }

  get name () {
    return this._name
  }

  get photoURL () {
    return this._photoURL
  }

  get department () {
    return this._department
  }

  get pageURL () {
    return this._pageURL
  }
}

module.exports = SigaaSearchTeacherResult
