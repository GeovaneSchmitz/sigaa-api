const cheerio = require('cheerio')

const SigaaBase = require('../common/sigaa-base')
const SigaaSearchTeacherResult = require('./sigaa-search-teacher-result')

class SigaaSearchTeacher extends SigaaBase {
  async loadSearchPage () {
    if (!this.searchPage) {
      const page = await this._get('/sigaa/public/docente/busca_docentes.jsf')
      this.$ = cheerio.load(page.body)
    }
  }

  async getCampusList () {
    await this.loadSearchPage()
    const campusOptionElements = this.$('select#form\\:departamento > option').toArray()
    const list = []
    for (const campusOptionElement of campusOptionElements) {
      list.push({
        name: this._removeTagsHtml(this.$(campusOptionElement).html()),
        value: this._removeTagsHtml(this.$(campusOptionElement).val())
      })
    }
    return list
  }

  async search (teacherName, campus) {
    await this.loadSearchPage()
    let campusValue
    if (!campus) {
      campusValue = 0
    } else {
      campusValue = campus.value
    }
    const formElement = this.$('form[name="form"]')
    const action = formElement.attr('action')
    const postOptions = {}
    const inputs = formElement.find("input[name]:not([type='submit'])").toArray()
    for (const input of inputs) {
      postOptions[this.$(input).attr('name')] = this.$(input).val()
    }
    postOptions['form:nome'] = teacherName
    postOptions['form:departamento'] = campusValue
    postOptions['form:buscar'] = 'Buscar'
    return this._post(action, postOptions)
      .then(page => this._extractSearchResults(page))
  }

  async _extractSearchResults (page) {
    this.$ = cheerio.load(page.body)
    const rowElements = this.$('table.listagem > tbody > tr[class]').toArray()
    const results = []
    for (const rowElement of rowElements) {
      const name = this._removeTagsHtml(this.$(rowElement).find('span.nome').html())
      const department = this._removeTagsHtml(this.$(rowElement).find('span.departamento').html())
      const pageHREF = this._removeTagsHtml(this.$(rowElement).find('span.pagina > a').attr('href'))
      const photoHREF = this._removeTagsHtml(this.$(rowElement).find('img').attr('src'))
      const pageURL = new URL(pageHREF, this._sigaaSession.url).href
      let photoURL = new URL(photoHREF, this._sigaaSession.url).href
      if (photoURL.includes('no_picture.png')) {
        photoURL = null
      }
      results.push(new SigaaSearchTeacherResult({
        name,
        department,
        pageURL,
        photoURL
      }, this._sigaaSession))
    }
    return results
  }
}

module.exports = SigaaSearchTeacher
