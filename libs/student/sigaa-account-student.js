const cheerio = require('cheerio')

const SigaaAccount = require('../common/sigaa-account')
const SigaaClassStudent = require('./sigaa-class-student')

class SigaaAccountStudent extends SigaaAccount {
  getAllClasses () {
    return this._get('/sigaa/portais/discente/turmas.jsf')
      .then(page =>
        new Promise((resolve, reject) => {
          const $ = cheerio.load(page.body, {
            normalizeWhitespace: true
          })
          const table = $('.listagem')
          if (table.length === 0) resolve([])
          const listClasses = []
          let period
          const self = this
          table.find('tbody > tr').each(function () {
            const cellElements = $(this).find('td')
            if (cellElements.eq(0).hasClass('periodo')) {
              period = self._removeTagsHtml(cellElements.html())
            } else if (period) {
              const buttonClassPage = cellElements.eq(5).find('a[onclick]')
              if (buttonClassPage) {
                const classData = {}
                const fullname = self._removeTagsHtml(cellElements.eq(0).html())
                classData.title = fullname.slice(fullname.indexOf(' - ') + 3)
                classData.abbreviation = fullname.slice(0, fullname.indexOf(' - '))
                classData.numberOfStudents = self._removeTagsHtml(cellElements.eq(2).html())
                classData.schedule = self._removeTagsHtml(cellElements.eq(4).html())
                classData.period = period
                classData.form = self._extractJSFCLJS(buttonClassPage.attr('onclick'), $)
                classData.id = classData.form.postOptions['idTurma']
                listClasses.push(new SigaaClassStudent(classData, self._sigaaSession))
              }
            }
          })
          resolve(listClasses)
        }))
  }

  async getUsername () {
    const page = await this._get('/sigaa/portais/discente/discente.jsf')
    if (page.statusCode === 200) {
      const $ = cheerio.load(page.body, {
        normalizeWhitespace: true
      })
      const username = this._removeTagsHtml($('p.usuario > span').html())
      return username
    } else if (page.statusCode === 302) {
      throw new Error('SESSION_EXPIRED')
    } else {
      throw new Error(`SIGAA_STATUSCODE_${page.statusCode}`)
    }
  }

  getClasses () {
    return this._get('/sigaa/portais/discente/discente.jsf')
      .then(page => {
        return new Promise((resolve, reject) => {
          if (page.statusCode === 200) {
            const $ = cheerio.load(page.body, {
              normalizeWhitespace: true
            })
            const tbodyClasses = $('div#turmas-portal.simple-panel > table[style="margin-top: 1%;"] > tbody')
            if (tbodyClasses.length === 0) resolve([])
            const trsClasses = tbodyClasses.find("tr[class=''], tr.odd")
            const list = []
            for (var i = 0; i < trsClasses.length; i++) {
              const cells = trsClasses.eq(i).find('td')

              const titleElement = cells.first().find('a')
              const title = this._removeTagsHtml(titleElement.html())
              const form = this._extractJSFCLJS(titleElement.attr('onclick'), $)
              const id = form.postOptions['idTurma']
              const location = this._removeTagsHtml(cells.eq(1).html())
              const schedule = this._removeTagsHtml(cells.eq(2).children().first().html())
              list.push(new SigaaClassStudent({
                title,
                id,
                form,
                location,
                schedule
              }, this._sigaaSession))
            }
            resolve(list)
          } else if (page.statusCode === 302) {
            reject(new Error('SESSION_EXPIRED'))
          } else {
            reject(new Error(`SIGAA_STATUSCODE_${page.statusCode}`))
          }
        })
      })
  }
}

module.exports = SigaaAccountStudent
