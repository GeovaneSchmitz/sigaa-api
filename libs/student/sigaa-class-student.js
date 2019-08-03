const SigaaBase = require('../common/sigaa-base')
const { JSDOM } = require('jsdom')

const SigaaTopic = require('./sigaa-topic-student')
const SigaaNews = require('./sigaa-news-student')

const SigaaFile = require('./sigaa-file-student')
const SigaaHomework = require('./sigaa-homework-student')
const SigaaQuiz = require('./sigaa-quiz-student')
const SigaaSurvey = require('./sigaa-survey-student')
const SigaaWebContent = require('./sigaa-web-content-student')

class SigaaClassStudent extends SigaaBase {
  constructor (params, sigaaSession) {
    super(sigaaSession)
    if (params.title !== undefined &&
      params.id !== undefined &&
      params.form !== undefined) {
      this._title = params.title
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
    this._homeworks = []
    this._videos = []
    this._files = []
    this._surveys = []
    this._quizzes = []
    this._webContents = []
    this._news = []
  }

  get title () {
    return this._title
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
        this._topics.forEach((topic) => {
          topic.finish()
          return false
        })
        this._videos = []
        this._topics = []
        const topicsElements = this._topicGetElements(res)
        for (const topicElement of topicsElements) {
          const topicOptions = this._topicExtractor(topicElement, res)
          const topic = new SigaaTopic(topicOptions)
          this._topics.push(topic)
        }
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
    const topic = {}
    const titleElement = topicElement.querySelector('.titulo')
    const titleFull = this._removeTagsHtml(titleElement.innerHTML)
    const topicDates = titleFull.slice(titleFull.lastIndexOf('(') + 1, titleFull.lastIndexOf(')'))
    if (topicDates.includes(' ')) {
      const startDate = this._removeTagsHtml(topicDates.slice(0, topicDates.indexOf(' '))).split('/')
      topic.startTimestamp = Math.trunc(new Date(`${startDate[1]}/${startDate[0]}/${startDate[2]}`) / 1000)
      const endDate = this._removeTagsHtml(topicDates.slice(topicDates.lastIndexOf(' ') + 1)).split('/')
      topic.endTimestamp = Math.trunc(new Date(`${endDate[1]}/${endDate[0]}/${endDate[2]}`) / 1000)
    } else {
      const date = this._removeTagsHtml(topicDates).split('/')
      const timestamp = Math.trunc(new Date(`${date[1]}/${date[0]}/${date[2]}`) / 1000)
      topic.startTimestamp = timestamp
      topic.endTimestamp = timestamp
    }
    topic.title = this._removeTagsHtml(titleFull.slice(0, titleFull.lastIndexOf('(')))
    const topicContentElement = topicElement.querySelector('.conteudotopico')
    topic.contentText = decodeURI(this._removeTagsHtml(topicContentElement.innerHTML.replace(/<div([\S\s]*?)div>/gm, '')))
    topic.attachments = this._extractAttachmentsFromTopic(topicContentElement, page)
    return topic
  }

  getFiles () {
    return this._clickLeftSidebarButton('Arquivos')
      .then(page => {
        return new Promise((resolve, reject) => {
          const { document } = new JSDOM(page.body).window

          const table = document.querySelector('.listing')

          if (!table) resolve([])
          const rows = table.querySelectorAll('tr[class]')
          const usedFilesIndex = []
          for (const row of rows) {
            const cells = row.children
            const title = this._removeTagsHtml(cells[0].innerHTML)
            const description = this._removeTagsHtml(cells[1].innerHTML)

            const buttonElement = cells[3].querySelector('a[onclick]')
            const form = this._extractJSFCLJS(buttonElement.getAttribute('onclick'), page.body)
            const id = form.postOptions.id
            const fileOptions = { title, description, form }
            const [files, index] = this._updateList(fileOptions, id, SigaaFile, this._files, this.getFiles.bind(this))
            this._files = files
            usedFilesIndex.push(index)
          }
          this._files = this._files.filter((file, index) => {
            if (usedFilesIndex.indexOf(index) > -1) {
              return true
            } else {
              file.finish()
              return false
            }
          })
          resolve(this._files)
        })
      })
  }

  _extractAttachmentsFromTopic (topicContentElement, page) {
    const topicAttachments = []
    if (topicContentElement.querySelector('span[id] > div.item')) {
      for (const attachmentElement of topicContentElement.querySelectorAll('span[id] > div.item')) {
        const iconElement = attachmentElement.querySelector('img')
        if (iconElement.src.includes('questionario.png')) {
          const quizOptions = this._extractAttachmentQuiz(attachmentElement, page)
          const id = quizOptions.id
          const [quizzes, index] = this._updateList(quizOptions, id, SigaaQuiz, this._quizzes, this.getQuizzes.bind(this))
          this._quizzes = quizzes
          topicAttachments.push(this._quizzes[index])
        } else if (iconElement.src.includes('video.png')) {
          const videoOptions = this._extractAtachmentVideo(attachmentElement)
          this._videos.push(videoOptions)
          topicAttachments.push(this._videos)
        } else if (iconElement.src.includes('tarefa.png')) {
          const homeworkOptions = this._extractAttachmentHomework(attachmentElement, page)
          const id = homeworkOptions.id
          const [homeworks, index] = this._updateList(homeworkOptions, id, SigaaHomework, this._homeworks, this.getHomeworks.bind(this))
          this._homeworks = homeworks
          topicAttachments.push(this._homeworks[index])
        } else if (iconElement.src.includes('pesquisa.png')) {
          const surveyOptions = this._extractAttacmentSurvey(attachmentElement, page)
          const id = surveyOptions.form.postOptions.id
          const [surveys, index] = this._updateList(surveyOptions, id, SigaaSurvey, this._surveys, this.getSurveys.bind(this))
          this._surveys = surveys
          topicAttachments.push(this._surveys[index])
        } else if (iconElement.src.includes('conteudo.png')) {
          const webContentOptions = this._extractAttachmentWebContent(attachmentElement, page)
          const id = webContentOptions.form.postOptions.id
          const [webContents, index] = this._updateList(webContentOptions, id, SigaaWebContent, this._webContents, this.getWebContents.bind(this))
          this._webContents = webContents
          topicAttachments.push(this._webContents[index])
        } else {
          const fileOptions = this._extractAttachmentFile(attachmentElement, page)
          const id = fileOptions.form.postOptions.id
          const [files, index] = this._updateList(fileOptions, id, SigaaFile, this._files, this.getFiles.bind(this))
          this._files = files
          topicAttachments.push(this._files[index])
        }
      }
    }
    return topicAttachments
  }

  _extractAttachmentFile (attachmentElement, page) {
    const attachment = {}
    const titleElement = attachmentElement.querySelector('span').firstChild
    attachment.title = this._removeTagsHtml(titleElement.innerHTML.trim())
    attachment.form = this._extractJSFCLJS(titleElement.getAttribute('onclick'), page.body)
    const descriptionElement = attachmentElement.querySelector('div.descricao-item')
    attachment.description = decodeURI(this._removeTagsHtml(descriptionElement.innerHTML))
    return attachment
  }

  _extractAttachmentWebContent (attachmentElement, page) {
    const attachment = {}
    const titleElement = attachmentElement.querySelector('span').firstChild
    attachment.title = this._removeTagsHtml(titleElement.innerHTML.trim())
    attachment.form = this._extractJSFCLJS(titleElement.getAttribute('onclick'), page.body)
    const descriptionElement = attachmentElement.querySelector('div.descricao-item')
    attachment.description = decodeURI(this._removeTagsHtml(descriptionElement.innerHTML))
    return attachment
  }

  _extractAttacmentSurvey (attachmentElement, page) {
    const attachment = {}
    const titleElement = attachmentElement.querySelector('span > a')
    attachment.title = this._removeTagsHtml(titleElement.innerHTML.trim())
    attachment.form = this._extractJSFCLJS(titleElement.getAttribute('onclick'), page.body)
    return attachment
  }

  _extractAttachmentHomework (attachmentElement, page) {
    const attachment = {}
    const titleElement = attachmentElement.querySelector('span > a')
    const form = this._extractJSFCLJS(titleElement.getAttribute('onclick'), page.body)
    attachment.id = form.postOptions.id
    attachment.title = this._removeTagsHtml(titleElement.innerHTML.trim())
    const descriptionElement = attachmentElement.querySelector('div.descricao-item')
    const description = decodeURI(this._removeTagsHtml(descriptionElement.innerHTML))
    const dates = this._extractDateTimestamps(description)
    attachment.startTimestamp = dates[0]
    attachment.endTimestamp = dates[1]
    return attachment
  }

  _extractAtachmentVideo (attachmentElement) {
    const attachment = {}
    attachment.src = attachmentElement.querySelector('iframe').getAttribute('src')
    const titleElement = attachmentElement.querySelector('span[id] > span[id]')
    attachment.title = this._removeTagsHtml(titleElement.innerHTML.trim())
    const descriptionElement = attachmentElement.querySelector('div.descricao-item')
    attachment.description = decodeURI(this._removeTagsHtml(descriptionElement.innerHTML))
    return attachment
  }

  _extractAttachmentQuiz (attachmentElement, page) {
    const attachment = {}
    const titleElement = attachmentElement.querySelector('span > a')
    attachment.title = this._removeTagsHtml(titleElement.innerHTML.trim())
    const form = this._extractJSFCLJS(titleElement.getAttribute('onclick'), page.body)
    attachment.id = form.postOptions.id
    const descriptionElement = attachmentElement.querySelector('div.descricao-item')
    const description = decodeURI(this._removeTagsHtml(descriptionElement.innerHTML))
    const dates = this._extractDateTimestamps(description)
    attachment.startTimestamp = dates[0]
    attachment.endTimestamp = dates[1]
    return attachment
  }

  _extractDateTimestamps (description) {
    const dateStrings = description.match(/[0-9]+[\S\s]+?[0-9]((?= )|(?=$))/g)
    const createDateFromString = (dataString, timeString) => {
      const dateSplited = dataString.match(/[0-9]+/g)
      if (!timeString) {
        timeString = '00:00'
      }
      const timeSplited = timeString.match(/[0-9]+/g)
      return new Date(`${dateSplited[2]}-${dateSplited[1]}-${dateSplited[0]}T${('0' + timeSplited[0]).substr(-2)}:${('0' + timeSplited[1]).substr(-2)}:00.000-03:00`)
    }
    const dates = []
    let currentDate
    for (let i = 0; i < dateStrings.length; i++) {
      if (dateStrings[i].includes('/')) {
        currentDate = dateStrings[i]
        if (dateStrings[i + 1] && (dateStrings[i + 1].includes(':') || dateStrings[i + 1].includes('h'))) {
          dates.push(createDateFromString(dateStrings[i], dateStrings[i + 1]).valueOf() / 1000)
          i++
        } else {
          dates.push(createDateFromString(dateStrings[i]).valueOf() / 1000)
        }
      }
      if (currentDate && (dateStrings[i].includes(':') || dateStrings[i].includes('h'))) {
        dates.push(createDateFromString(currentDate, dateStrings[i]).valueOf() / 1000)
      }
    }
    return dates
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
              const title = this._removeTagsHtml(cell[0].innerHTML)
              const date = this._removeTagsHtml(cell[1].innerHTML)

              const buttonElement = cell[2].firstChild
              const form = this._extractJSFCLJS(buttonElement.getAttribute('onclick'), res.body)
              const id = form.postOptions.id
              const newsOptions = { title, date, form }
              const [news, index] = this._updateList(newsOptions, id, SigaaNews, this._news, this.getNews.bind(this))
              this._news = news
              usedNewsIndex.push(index)
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
              const title = this._removeTagsHtml(cell[0].innerHTML)
              const date = this._removeTagsHtml(cell[1].innerHTML)

              const buttonEl = cell[2].firstChild
              const form = this._extractJSFCLJS(buttonEl.getAttribute('onclick'), res.body)
              this._news.push(new SigaaNews(
                {
                  title,
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
      .then(page => new Promise((resolve, reject) => {
        const { document } = new JSDOM(page.body).window
        const getBtnEl = Array.from(document.querySelectorAll('div.itemMenu')).find(el => {
          return el.textContent === buttonLabel
        })
        const form = this._extractJSFCLJS(getBtnEl.parentElement.getAttribute('onclick'), page.body)
        resolve(this._post(form.action, form.postOptions))
      }))
      .then((page) => {
        return new Promise((resolve, reject) => {
          if (page.statusCode === 200) {
            resolve(page)
          } else if (page.statusCode === 302 && page.headers.location.includes('/sigaa/expirada.jsp')) {
            reject(new Error('ACCOUNT_SESSION_EXPIRED'))
          } else {
            reject(new Error(`SIGAA_STATUSCODE_${page.statusCode}`))
          }
        })
      })
  }

  async _getRightSidebarCard (cardTitle) {
    const page = await this._requestClassPage()
    const { document } = new JSDOM(page.body).window
    const titleElement = Array.from(document.querySelectorAll('.rich-stglpanel-header.headerBloco'))
      .find(element => {
        return this._removeTagsHtml(element.innerHTML) === cardTitle
      })
    if (!titleElement) {
      throw new Error('CARD_TITLE_NOT_FOUND')
    } else {
      return titleElement.parentElement.parentElement
    }
  }

  async getExamCalendar () {
    const card = await this._getRightSidebarCard('Avaliações')
    const examElements = card.querySelectorAll('li')
    const examList = []
    for (const examElement of examElements) {
      const exam = {}
      exam.description = this._removeTagsHtml(examElement.querySelector('span.descricao').innerHTML)
      exam.date = this._removeTagsHtml(examElement.querySelector('span.data').innerHTML)
      examList.push(exam)
    }
    return examList
  }

  async getQuizzes () {
    const page = await this._clickLeftSidebarButton('Questionários')
    return new Promise((resolve, reject) => {
      const { document } = new JSDOM(page.body).window

      const table = document.querySelector('.listing')

      if (!table) resolve([])
      const rows = table.querySelectorAll('tr[class]')
      const usedQuizzesIndex = []

      for (const row of rows) {
        const cells = row.querySelectorAll('td')
        const title = this._removeTagsHtml(cells[0].innerHTML)
        const startDate = this._removeTagsHtml(cells[1].innerHTML)
        const endDate = this._removeTagsHtml(cells[2].innerHTML)
        const timestamps = this._extractDateTimestamps(`${startDate} ${endDate}`)
        const buttonSendAnswersElement = cells[3].querySelector('a[onclick]')
        if (buttonSendAnswersElement) {
          var formSendAnswers = this._extractJSFCLJS(buttonSendAnswersElement.getAttribute('onclick'), page.body)
        }
        const buttonViewAnswersSubmittedElement = cells[4].querySelector('a[onclick]')
        if (buttonViewAnswersSubmittedElement) {
          var formViewAnswersSubmitted = this._extractJSFCLJS(buttonViewAnswersSubmittedElement.getAttribute('onclick'), page.body)
        }
        const form = formSendAnswers || formViewAnswersSubmitted
        const id = form.postOptions.id

        const quizOptions = {
          title,
          startTimestamp: timestamps[0],
          endTimestamp: timestamps[1],
          id,
          formSendAnswers,
          formViewAnswersSubmitted
        }
        const [quizzes, index] = this._updateList(quizOptions, id, SigaaQuiz, this._quizzes, this.getQuizzes.bind(this))
        usedQuizzesIndex.push(index)
        this._quizzes = quizzes
      }
      this._quizzes = this._quizzes.filter((quiz, index) => {
        if (usedQuizzesIndex.indexOf(index) > -1) {
          return true
        } else {
          quiz.finish()
          return false
        }
      })
      resolve(this._quizzes)
    })
  }

  async getWebContents () {
    const page = await this._clickLeftSidebarButton('Conteúdo/Página web')
    return new Promise((resolve, reject) => {
      const { document } = new JSDOM(page.body).window

      const table = document.querySelector('.listing')

      if (!table) resolve([])
      const rows = table.querySelectorAll('tr[class]')
      const usedwebContentsIndex = []

      for (const row of rows) {
        const cells = row.querySelectorAll('td')
        const title = this._removeTagsHtml(cells[0].innerHTML)
        const dateString = this._removeTagsHtml(cells[1].innerHTML)
        const timestamp = this._extractDateTimestamps(dateString)[0]
        const form = this._extractJSFCLJS(cells[2].querySelector('a[onclick]').getAttribute('onclick'), page.body)
        const id = form.postOptions.id
        const webContentOptions = {
          title,
          timestamp,
          form
        }

        const [webContents, index] = this._updateList(webContentOptions, id, SigaaWebContent, this._webContents, this.getWebContents.bind(this))
        usedwebContentsIndex.push(index)
        this._webContents = webContents
      }
      this._webContents = this._webContents.filter((webContent, index) => {
        if (usedwebContentsIndex.indexOf(index) > -1) {
          return true
        } else {
          webContent.finish()
          return false
        }
      })
      resolve(this._webContents)
    })
  }

  async getSurveys () {
    // TODO
  }

  async getHomeworks () {
    return this._clickLeftSidebarButton('Tarefas')
      .then(page => {
        return new Promise((resolve, reject) => {
          const { document } = new JSDOM(page.body).window

          const table = document.querySelector('.listing')

          if (!table) resolve([])
          const rows = table.querySelectorAll('tr[class]')
          const usedHomeworksIndex = []

          for (let i = 0; i < rows.length; i += 2) {
            const cells = rows[i].querySelectorAll('td')
            const cellDescription = rows[i + 1].querySelector('td')
            const title = this._removeTagsHtml(cells[1].innerHTML)
            const description = this._removeTagsHtml(cellDescription.innerHTML)
            const date = this._removeTagsHtml(cells[2].innerHTML)
            const timestamps = this._extractDateTimestamps(date)
            let haveGrade = true
            if (this._removeTagsHtml(cells[3].innerHTML) === 'Não') haveGrade = false
            const buttonSendHomeworkElement = cells[5].querySelector('a[onclick]')
            if (buttonSendHomeworkElement) {
              var formSendHomework = this._extractJSFCLJS(buttonSendHomeworkElement.getAttribute('onclick'), page.body)
            }
            const buttonViewHomeworkSubmittedElement = cells[6].querySelector('a[onclick]')
            if (buttonViewHomeworkSubmittedElement) {
              var formViewHomeworkSubmitted = this._extractJSFCLJS(buttonViewHomeworkSubmittedElement.getAttribute('onclick'), page.body)
            }
            const form = formSendHomework || formViewHomeworkSubmitted
            const id = form.postOptions.id

            const homeworkOptions = {
              title,
              startTimestamp: timestamps[0],
              endTimestamp: timestamps[1],
              description,
              id,
              formSendHomework,
              formViewHomeworkSubmitted,
              haveGrade
            }

            const [homeworks, index] = this._updateList(homeworkOptions, id, SigaaHomework, this._homeworks, this.getHomeworks.bind(this))
            usedHomeworksIndex.push(index)
            this._homeworks = homeworks
          }
          this._homeworks = this._homeworks.filter((homework, index) => {
            if (usedHomeworksIndex.indexOf(index) > -1) {
              return true
            } else {
              homework.finish()
              return false
            }
          })
          resolve(this._homeworks)
        })
      })
  }

  _updateList (options, id, SigaaClass, classList, updateMethod) {
    const classIndex = classList.findIndex((classItem) => {
      return id === classItem.id
    })

    if (classIndex === -1) {
      const newClass = new SigaaClass(options, updateMethod, this._sigaaSession)
      classList.push(newClass)
      return [classList, classList.length - 1]
    } else {
      classList[classIndex].update(options)
      return [classList, classIndex]
    }
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
                let value = parseFloat(this._removeTagsHtml(valueCells[index].innerHTML).replace(/,/g, '.'))
                if (!value) value = null
                gradeGroup.value = value
              } else {
                gradeGroup.grades = []
                for (let j = index; j < index + theadElements[0][i].colSpan; j++) {
                  const gradeId = theadElements[1][j].id.slice(5)

                  if (gradeId !== '') {
                    const gradeName = document.querySelector(`input#denAval_${gradeId}`).value
                    const gradeAbbreviation = document.querySelector(`input#abrevAval_${gradeId}`).value
                    const gradeWeight = document.querySelector(`input#pesoAval_${gradeId}`).value
                    let value = parseFloat(this._removeTagsHtml(valueCells[j].innerHTML).replace(/,/g, '.'))
                    if (!value) value = null
                    gradeGroup.grades.push({
                      name: gradeName,
                      abbreviation: gradeAbbreviation,
                      weight: gradeWeight,
                      value
                    })
                  } else {
                    let average = parseFloat(this._removeTagsHtml(valueCells[j].innerHTML).replace(/,/g, '.'))
                    if (!average) average = null
                    gradeGroup.average = average
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
