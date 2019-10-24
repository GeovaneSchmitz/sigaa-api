const cheerio = require('cheerio')
const SigaaAccount = require('../common/sigaa-account')
const SigaaClassStudent = require('./sigaa-class-student')

class SigaaAccountStudent extends SigaaAccount {
  async _getCertificateEnrollmentPage () {
    const page = await this._get('/sigaa/portais/discente/discente.jsf')
    if (page.statusCode === 200) {
      const $ = cheerio.load(page.body, {
        normalizeWhitespace: true
      })
      const formElement = $('#menu\\:form_menu_discente')
      const action = new URL(formElement.attr('action'), this._sigaaSession.url).href
      const postOptions = {}
      formElement.find('input').each(function () {
        postOptions[$(this).attr('name')] = $(this).val()
      })
      postOptions['jscook_action'] = 'menu_form_menu_discente_j_id_jsp_1383391995_85_menu:A]#{ portalDiscente.atestadoMatricula }'
      this._sigaaSession.formLoginAction = action
      this._sigaaSession.formLoginPostOptions = postOptions
      return this._post(action, postOptions)
    } else if (page.statusCode === 302) {
      throw new Error('SESSION_EXPIRED')
    } else {
      throw new Error(`SIGAA_STATUSCODE_${page.statusCode}`)
    }
  }

  getClasses (allPeriods) {
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
          let rows = table.find('tbody > tr').toArray()
          if (!allPeriods) {
            let lastPeriodIndex
            for (let i = 0; i < rows.length; i++) {
              const cellElements = $(rows[i]).find('td')
              if (cellElements.eq(0).hasClass('periodo')) {
                lastPeriodIndex = i
              }
            }
            rows = rows.slice(lastPeriodIndex)
          }
          for (const row of rows) {
            const cellElements = $(row).find('td')
            if (cellElements.eq(0).hasClass('periodo')) {
              period = this._removeTagsHtml(cellElements.html())
            } else if (period) {
              const buttonClassPage = cellElements.eq(5).find('a[onclick]')
              if (buttonClassPage) {
                const classData = {}
                const fullname = this._removeTagsHtml(cellElements.eq(0).html())
                classData.title = fullname.slice(fullname.indexOf(' - ') + 3)
                classData.abbreviation = fullname.slice(0, fullname.indexOf(' - '))
                classData.numberOfStudents = this._removeTagsHtml(cellElements.eq(2).html())
                classData.schedule = this._removeTagsHtml(cellElements.eq(4).html())
                classData.period = period
                classData.form = this._extractJSFCLJS(buttonClassPage.attr('onclick'), $)
                classData.id = classData.form.postOptions['idTurma']
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
}

module.exports = SigaaAccountStudent
