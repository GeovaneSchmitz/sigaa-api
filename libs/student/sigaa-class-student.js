const SigaaBase = require('../common/sigaa-base')
const SigaaTopic = require('./sigaa-topic-student')
const SigaaNews = require('./sigaa-news-student')
const { JSDOM } = require('jsdom')

class SigaaClassStudent extends SigaaBase {
  constructor (params, sigaaSession) {
    super(sigaaSession)
    if (params.name !== undefined &&
      params.id !== undefined &&
      params.form !== undefined) {
      this._name = params.name
      this._id = params.id
      this._form = params.form
    } else {
      throw new Error('CLASS_MISSING_PARAMETERS')
    }
    if (params.location) {
      this._location = params.location
    }
    if (params.schedule) {
      this._schedule = params.schedule
    }
    if (params.abbreviation) {
      this._abbreviation = params.abbreviation
    }
    if (params.numberOfStudents) {
      this._numberOfStudents = params.numberOfStudents
    }
    if (params.period) {
      this._period = params.period
    }
    this._topics = []
    this._news = []
  }

  get name () {
    return this._name
  }

  get id () {
    return this._id
  }

  get location () {
    return this._location
  }

  get period () {
    return this._period
  }

  get scheduleSIGAAnotation () {
    return this._schedule
  }

  get abbreviation () {
    return this._abbreviation
  }

  get numberOfStudents () {
    return this._numberOfStudents
  }

  _requestClassPageUsingId () {
    return this._get('/sigaa/portais/discente/turmas.jsf')
      .then(page => new Promise((resolve, reject) => {
        if (page.statusCode === 200) {
          const { document } = new JSDOM(page.body).window
          const table = document.getElementsByClassName('listagem')[0]
          let currentPeriod
          for (const rowElement of table.querySelectorAll('tbody > tr')) {
            const cellElements = rowElement.querySelectorAll('td')
            if (cellElements[0].classList.contains('periodo')) {
              currentPeriod = this._removeTagsHtml(cellElements[0].innerHTML)
            } else if (currentPeriod) {
              const JSFCLJSCode = cellElements[5].querySelector('a[onclick]').getAttribute('onclick')
              const form = this._extractJSFCLJS(JSFCLJSCode, page.body)
              if (form.postOptions.idTurma === this.id) {
                const fullname = this._removeTagsHtml(cellElements[0].innerHTML)
                this._name = fullname.slice(fullname.indexOf(' - ') + 3)
                this._abbreviation = fullname.slice(0, fullname.indexOf(' - '))
                this._numberOfStudents = this._removeTagsHtml(cellElements[2].innerHTML)
                this._schedule = this._removeTagsHtml(cellElements[4].innerHTML)
                this._form = form
                resolve(this._requestClassPageUsingForm())
              }
            }
          }
          reject(new Error('CLASS_NOT_FOUND'))
        } else if (page.statusCode === 302 && page.headers.location.includes('/sigaa/expirada.jsp')) {
          reject(new Error('ACCOUNT_SESSION_EXPIRED'))
        } else {
          reject(new Error(`SIGAA_STATUSCODE_${page.statusCode}`))
        }
      }))
  }

  _requestClassPageUsingForm () {
    return this._post(this._form.action, this._form.postOptions)
      .then(page => new Promise((resolve, reject) => {
        if (page.statusCode === 200) {
          if (page.body.includes('Comportamento Inesperado!')) {
            reject(new Error('INVALID_CLASS_ID'))
          }
          resolve(page)
        } else {
          reject(new Error(`SIGAA_STATUSCODE_${page.statusCode}`))
        }
      }))
  }

  _requestClassPage () {
    return this._requestClassPageUsingForm()
      .catch(() => {
        return this._requestClassPageUsingId()
      })
  }

  getTopics () {
    return this._requestClassPage()
      .then(res => new Promise((resolve, reject) => {
        const topicsElements = this._topicGetElements(res)
        const usedTopicsIndex = []
        for (const topicEl of topicsElements) {
          const topic = this._topicExtractor(topicEl, res)
          const topicClassIndex = this._topics.findIndex((topicClass) => {
            return topicClass.name === topic.name &&
              topicClass.startTimestamp === topic.startTimestamp &&
              topicClass.endTimestamp === topic.endTimestamp &&
              topicClass.contentText === topic.contentText
          })
          if (topicClassIndex > -1) {
            usedTopicsIndex.push(topicClassIndex)
            this._topics[topicClassIndex].update(topic)
          } else {
            this._topics.push(
              new SigaaTopic(topic, this.getTopics.bind(this),
                this._sigaaSession))
            usedTopicsIndex.push(this._topics.length - 1)
          }
        }
        this._topics = this._topics.filter((topic, index) => {
          if (usedTopicsIndex.indexOf(index) > -1) {
            return true
          } else {
            topic.finish()
            return false
          }
        })

        resolve(this._topics)
      }))
  }

  _topicGetElements (res) {
    const { document } = new JSDOM(res.body).window
    const contentElement = document.getElementById('conteudo')
    let topicsElements
    if (contentElement) {
      topicsElements = contentElement.querySelectorAll('.topico-aula')
    } else {
      topicsElements = []
    }
    return topicsElements
  }

  _topicExtractor (topicElement, page) {
    const topicNameElement = topicElement.querySelector('.titulo')
    const topicNameFull = this._removeTagsHtml(topicNameElement.innerHTML)
    const topic = {}
    const topicDates = topicNameFull.slice(topicNameFull.lastIndexOf('(') + 1, topicNameFull.lastIndexOf(')'))
    topic.name = this._removeTagsHtml(topicNameFull.slice(0, topicNameFull.lastIndexOf('(')))
    const startDate = this._removeTagsHtml(topicDates.slice(0, topicDates.indexOf(' '))).split('/')
    topic.startTimestamp = Math.trunc(new Date(`${startDate[1]}/${startDate[0]}/${startDate[2]}`) / 1000)
    const endDate = this._removeTagsHtml(topicDates.slice(topicDates.lastIndexOf(' ') + 1)).split('/')
    topic.endTimestamp = Math.trunc(new Date(`${endDate[1]}/${endDate[0]}/${endDate[2]}`) / 1000)
    const topicContentElement = topicElement.querySelector('.conteudotopico')
    topic.contentText = decodeURI(this._removeTagsHtml(topicContentElement.innerHTML.replace(/<div([\S\s]*?)div>/gm, '')))
    topic.attachments = this._extractAttachmentsFromTopic(topicContentElement, page)
    return topic
  }

  _extractAttachmentsFromTopic (topicContentElement, page) {
    const topicAttachments = []
    if (topicContentElement.querySelector('span[id] > div.item')) {
      for (const attachmentElement of topicContentElement.querySelectorAll('span[id] > div.item')) {
        const iconElement = attachmentElement.querySelector('img')
        if (iconElement.src.includes('questionario.png')) {
          topicAttachments.push(this._extractAttachmentQuiz(attachmentElement, page))
        } else if (iconElement.src.includes('video.png')) {
          topicAttachments.push(this._extractAtachmentVideo(attachmentElement))
        } else if (iconElement.src.includes('tarefa.png')) {
          const attachment = this._extractAttachmentHomework(attachmentElement, page, topicAttachments)
          topicAttachments.push(attachment)
        } else if (iconElement.src.includes('pesquisa.png')) {
          const attachment = this._extractAttacmentSurvey(attachmentElement, page)
          topicAttachments.push(attachment)
        } else if (iconElement.src.includes('conteudo.png')) {
          const attachment = this._extractAttachmentWebContent(attachmentElement, page)
          topicAttachments.push(attachment)
        } else {
          const attachment = this._extractAttachmentFile(attachmentElement, page)
          topicAttachments.push(attachment)
        }
      }
    }
    return topicAttachments
  }

  _extractAttachmentFile (attachmentElement, page) {
    const attachment = {}
    attachment.type = 'file'
    const titleElement = attachmentElement.querySelector('span').firstChild
    attachment.title = this._removeTagsHtml(titleElement.innerHTML.trim())
    attachment.form = this._extractJSFCLJS(titleElement.getAttribute('onclick'), page.body)
    const descriptionElement = attachmentElement.querySelector('div.descricao-item')
    attachment.description = decodeURI(this._removeTagsHtml(descriptionElement.innerHTML))
    return attachment
  }

  _extractAttachmentWebContent (attachmentElement, page) {
    const attachment = {}
    attachment.type = 'webContent'
    const titleElement = attachmentElement.querySelector('span').firstChild
    attachment.title = this._removeTagsHtml(titleElement.innerHTML.trim())
    attachment.form = this._extractJSFCLJS(titleElement.getAttribute('onclick'), page.body)
    const descriptionElement = attachmentElement.querySelector('div.descricao-item')
    attachment.description = decodeURI(this._removeTagsHtml(descriptionElement.innerHTML))
    return attachment
  }

  _extractAttacmentSurvey (attachmentElement, page) {
    const attachment = {}
    attachment.type = 'survey'
    const titleElement = attachmentElement.querySelector('span > a')
    attachment.title = this._removeTagsHtml(titleElement.innerHTML.trim())
    attachment.form = this._extractJSFCLJS(titleElement.getAttribute('onclick'), page.body)
    return attachment
  }

  _extractAttachmentHomework (attachmentElement, page) {
    const attachment = {}
    attachment.type = 'homework'
    const titleElement = attachmentElement.querySelector('span > a')
    attachment.form = this._extractJSFCLJS(titleElement.getAttribute('onclick'), page.body)
    attachment.title = this._removeTagsHtml(titleElement.innerHTML.trim())
    const descriptionElement = attachmentElement.querySelector('div.descricao-item')
    const description = decodeURI(this._removeTagsHtml(descriptionElement.innerHTML))
    const dates = this._extractDateTimestampsFromAttachmentDescription(description)
    attachment.startTimestamp = dates.startTimestamp
    attachment.endTimestamp = dates.endTimestamp
    return attachment
  }

  _extractAtachmentVideo (attachmentElement) {
    const attachment = {}
    attachment.type = 'video'
    attachment.src = attachmentElement.querySelector('iframe').getAttribute('src')
    const titleElement = attachmentElement.querySelector('span[id] > span[id]')
    attachment.title = this._removeTagsHtml(titleElement.innerHTML.trim())
    const descriptionElement = attachmentElement.querySelector('div.descricao-item')
    attachment.description = decodeURI(this._removeTagsHtml(descriptionElement.innerHTML))
    return attachment
  }

  _extractAttachmentQuiz (attachmentElement, page) {
    const attachment = {}
    attachment.type = 'quiz'
    const titleElement = attachmentElement.querySelector('span > a')
    attachment.title = this._removeTagsHtml(titleElement.innerHTML.trim())
    attachment.form = this._extractJSFCLJS(titleElement.getAttribute('onclick'), page.body)
    const descriptionElement = attachmentElement.querySelector('div.descricao-item')
    const description = decodeURI(this._removeTagsHtml(descriptionElement.innerHTML))
    const dates = this._extractDateTimestampsFromAttachmentDescription(description)
    attachment.startTimestamp = dates.startTimestamp
    attachment.endTimestamp = dates.endTimestamp
    return attachment
  }

  _extractDateTimestampsFromAttachmentDescription (description) {
    const DatesStrings = description.match(/[0-9]+[\S\s]+?[0-9]((?= )|(?=$))/g)
    const createDateFromString = (dataString, timeString) => {
      const dateSplited = dataString.match(/[0-9]+/g)
      const timeSplited = timeString.match(/[0-9]+/g)
      return new Date(`${dateSplited[2]}-${dateSplited[1]}-${dateSplited[0]}T${('0' + timeSplited[0]).substr(-2)}:${('0' + timeSplited[1]).substr(-2)}:00.000-03:00`)
    }
    const startDate = createDateFromString(DatesStrings[0], DatesStrings[1])
    const endDate = createDateFromString(DatesStrings[2], DatesStrings[3])

    return {
      startTimestamp: Math.trunc(startDate.valueOf() / 1000),
      endTimestamp: Math.trunc(endDate.valueOf() / 1000)
    }
  }

  getNews () {
    return this._clickLeftSidebarButton('Notícias')
      .then(res => {
        return new Promise((resolve, reject) => {
          const { document } = new JSDOM(res.body).window

          const table = document.querySelector('.listing')

          if (!table) resolve([])
          const rows = table.querySelectorAll('tr[class]')
          if (this._news.length !== 0) {
            const usedNewsIndex = []

            for (const row of rows) {
              const cell = row.children
              const name = this._removeTagsHtml(cell[0].innerHTML)
              const date = this._removeTagsHtml(cell[1].innerHTML)

              const buttonElement = cell[2].firstChild
              const form = this._extractJSFCLJS(buttonElement.getAttribute('onclick'), res.body)

              const newsClassIndex = this._news.findIndex((news) => {
                return form.postOptions.id === news.id
              })

              if (newsClassIndex === -1) {
                const newsClass = new SigaaNews({
                  name,
                  date,
                  form
                }, this.getNews.bind(this), this._sigaaSession)
                this._news.push(newsClass)
                usedNewsIndex.push(this._news.length - 1)
              } else {
                usedNewsIndex.push(newsClassIndex)
                this._news[newsClassIndex].update({ name, date, form })
              }
            }
            this._news = this._news.filter((news, index) => {
              if (usedNewsIndex.indexOf(index) > -1) {
                return true
              } else {
                news.finish()
                return false
              }
            })
          } else {
            for (const row of rows) {
              const cell = row.children
              const name = this._removeTagsHtml(cell[0].innerHTML)
              const date = this._removeTagsHtml(cell[1].innerHTML)

              const buttonEl = cell[2].firstChild
              const form = this._extractJSFCLJS(buttonEl.getAttribute('onclick'), res.body)
              this._news.push(new SigaaNews(
                {
                  name,
                  date,
                  form
                },
                this.getNews.bind(this),
                this._sigaaSession))
            }
            resolve(this._news)
          }
        })
      })
  }

  getAbsence () {
    return this._clickLeftSidebarButton('Frequência')
      .then(res => new Promise((resolve, reject) => {
        if (res.statusCode !== 200) reject(new Error(`SIGAA_STATUSCODE_${res.statusCode}`))

        const { document } = new JSDOM(res.body).window
        const table = document.querySelector('.listing')
        const absences = {
          list: []
        }
        if (!table) resolve(absences)
        const rows = table.querySelectorAll('tr[class]')
        for (const row of rows) {
          const cells = row.children
          const date = this._removeTagsHtml(cells[0].innerHTML)
          const statusString = this._removeTagsHtml(cells[1].innerHTML)
          let status
          if (statusString === '') continue
          else if (statusString === 'Presente') status = 0
          else status = parseInt(statusString.replace(/\D/gm, ''), 10)
          absences.list.push({
            date,
            status
          })
        }
        const details = document.querySelector('.botoes-show').innerHTML.split('<br>')
        for (const detail of details) {
          if (detail.includes('Total de Faltas')) {
            absences.totalAbsences = parseInt(detail.replace(/\D/gm, ''), 10)
          } else if (detail.includes('Máximo de Faltas Permitido')) {
            absences.maxAbsences = parseInt(detail.replace(/\D/gm, ''), 10)
          }
        }
        resolve(absences)
      }))
  }

  _clickLeftSidebarButton (buttonLabel) {
    return this._requestClassPage()
      .then(res => new Promise((resolve, reject) => {
        const { document } = new JSDOM(res.body).window
        const getGradesBtnEl = Array.from(document.querySelectorAll('div.itemMenu')).find(el => {
          return el.textContent === buttonLabel
        })
        const form = this._extractJSFCLJS(getGradesBtnEl.parentElement.getAttribute('onclick'), res.body)
        resolve(this._post(form.action, form.postOptions))
      }))
  }

  getGrades () {
    return this._clickLeftSidebarButton('Ver Notas')
      .then(res => {
        return new Promise((resolve, reject) => {
          const getPositionByCellColSpan = (ths, cell) => {
            var i = 0
            for (const tr of ths) {
              if (cell === tr) {
                return i
              }
              i += tr.colSpan
            }
            return false
          }

          const removeCellsWithName = [
            '',
            'Matrícula',
            'Nome',
            'Sit.',
            'Faltas'
          ]

          const { document } = new JSDOM(res.body).window
          var theadTrs = document.querySelectorAll('thead tr')
          var valueCells = document.querySelector('tbody tr').children

          const grades = []

          const theadElements = []
          for (const theadTr of theadTrs) {
            theadElements.push(theadTr.querySelectorAll('th'))
          }

          for (let i = 0; i < theadElements[0].length; i++) {
            const gradeGroupName = this._removeTagsHtml(theadElements[0][i].innerHTML)
            if (removeCellsWithName.indexOf(gradeGroupName) === -1) {
              const gradeGroup = {
                name: gradeGroupName
              }
              const index = getPositionByCellColSpan(theadElements[0], theadElements[0][i])
              if (theadElements[0][i].colSpan === 1) {
                gradeGroup.value = parseFloat(this._removeTagsHtml(valueCells[index].innerHTML).replace(/,/g, '.'))
              } else {
                gradeGroup.grades = []
                for (let j = index; j < index + theadElements[0][i].colSpan; j++) {
                  const gradeId = theadElements[1][j].id.slice(5)

                  if (gradeId !== '') {
                    const gradeName = document.querySelector(`input#denAval_${gradeId}`).value
                    const gradeAbbreviation = document.querySelector(`input#abrevAval_${gradeId}`).value
                    const gradeWeight = document.querySelector(`input#pesoAval_${gradeId}`).value
                    gradeGroup.grades.push({
                      name: gradeName,
                      abbreviation: gradeAbbreviation,
                      weight: gradeWeight,
                      value: parseFloat(this._removeTagsHtml(valueCells[j].innerHTML).replace(/,/g, '.'))
                    })
                  } else {
                    gradeGroup.average = parseFloat(this._removeTagsHtml(valueCells[j].innerHTML).replace(/,/g, '.'))
                  }
                }
              }
              grades.push(gradeGroup)
            }
          }
          resolve(grades)
        })
      })
  }
}

module.exports = SigaaClassStudent
