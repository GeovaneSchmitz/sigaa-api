const { JSDOM } = require('jsdom')

const SigaaAccount = require('../common/sigaa-account')
const SigaaClassStudent = require('./sigaa-class-student')

class SigaaAccountStudent extends SigaaAccount {
  getAllClasses () {
    return this._get('/sigaa/portais/discente/turmas.jsf')
      .then(page =>
        new Promise((resolve, reject) => {
          const { document } = new JSDOM(page.body).window
          const table = document.getElementsByClassName('listagem')[0]
          if (!table) resolve([])
          const listClasses = []
          let period
          for (const rowElement of table.querySelectorAll('tbody > tr')) {
            const cellElements = rowElement.querySelectorAll('td')
            if (cellElements[0].classList.contains('periodo')) {
              period = this._removeTagsHtml(cellElements[0].innerHTML)
            } else if (period) {
              const buttonClassPage = cellElements[5].querySelector('a[onclick]')
              if (buttonClassPage) {
                const classData = {}
                const fullname = this._removeTagsHtml(cellElements[0].innerHTML)
                classData.title = fullname.slice(fullname.indexOf(' - ') + 3)
                classData.abbreviation = fullname.slice(0, fullname.indexOf(' - '))
                classData.numberOfStudents = this._removeTagsHtml(cellElements[2].innerHTML)
                classData.schedule = this._removeTagsHtml(cellElements[4].innerHTML)
                classData.period = period
                classData.form = this._extractJSFCLJS(buttonClassPage.getAttribute('onclick'), page.body)
                classData.id = classData.form.postOptions.idTurma
                listClasses.push(new SigaaClassStudent(classData, this._sigaaSession))
              }
            }
          }
          resolve(listClasses)
        }))
  }

  async getUsername () {
    const page = await this._get('/sigaa/portais/discente/discente.jsf')
    if (page.statusCode === 200) {
      const { document } = new JSDOM(page.body).window
      const username = this._removeTagsHtml(document.querySelector('p.usuario > span').innerHTML)
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
            const { document } = new JSDOM(page.body).window
            const period = this._removeTagsHtml(document.querySelector('p.periodo-atual > strong').innerHTML)
            const tbodyClasses = document.querySelector('div#turmas-portal.simple-panel > table[style="margin-top: 1%;"] > tbody')
            if (!tbodyClasses) resolve([])
            const trsClasses = tbodyClasses.querySelectorAll("tr[class=''], tr.odd")
            const list = []
            for (var i = 0; i < trsClasses.length; i++) {
              const cells = trsClasses[i].querySelectorAll('td')

              const titleElement = cells[0].querySelector('a')
              const title = this._removeTagsHtml(titleElement.innerHTML)
              const form = this._extractJSFCLJS(titleElement.getAttribute('onclick'), page.body)
              const id = form.postOptions.idTurma
              const location = this._removeTagsHtml(cells[1].innerHTML)
              const schedule = this._removeTagsHtml(cells[2].firstChild.innerHTML)
              list.push(new SigaaClassStudent({
                title,
                id,
                period,
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
