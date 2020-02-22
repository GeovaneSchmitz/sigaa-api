const SigaaBase = require('../common/sigaa-base')
const Cheerio = require('cheerio')

const SigaaTopic = require('./sigaa-topic-student')
const SigaaNews = require('./sigaa-news-student')

const SigaaFile = require('./sigaa-file-student')
const SigaaHomework = require('./sigaa-homework-student')
const SigaaQuiz = require('./sigaa-quiz-student')
const SigaaSurvey = require('./sigaa-survey-student')
const SigaaWebContent = require('./sigaa-web-content-student')

class SigaaClassStudent extends SigaaBase {
  constructor(options, sigaaSession) {
    super(sigaaSession)
    if (
      options.title !== undefined &&
      options.id !== undefined &&
      options.form !== undefined
    ) {
      this._title = options.title
      this._id = options.id
      this._form = options.form
    } else {
      throw new Error('CLASS_MISSING_PARAMETERS')
    }
    if (options.location) {
      this._location = options.location
    }
    if (options.schedule) {
      this._schedule = options.schedule
    }
    if (options.abbreviation) {
      this._abbreviation = options.abbreviation
    }
    if (options.numberOfStudents) {
      this._numberOfStudents = options.numberOfStudents
    }
    if (options.period) {
      this._period = options.period
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

  get title() {
    return this._title
  }

  get id() {
    return this._id
  }

  get location() {
    return this._location
  }

  get period() {
    return this._period
  }

  get scheduleSIGAAnotation() {
    return this._schedule
  }

  get abbreviation() {
    return this._abbreviation
  }

  get numberOfStudents() {
    return this._numberOfStudents
  }

  async _requestClassPageUsingId() {
    const page = await this._get('/sigaa/portais/discente/turmas.jsf')
    if (page.statusCode === 200) {
      const $ = Cheerio.load(page.body, {
        normalizeWhitespace: true
      })
      const table = $('.listagem')
      if (table.length === 0) {
        throw new Error('CLASS_NOT_FOUND')
      }
      const rows = table.find('tbody > tr').toArray()
      const foundClass = rows.some((row) => {
        const cellElements = $(row).find('td')
        if (cellElements.eq(0).hasClass('periodo')) return false
        const buttonClassPage = cellElements.eq(5).find('a[onclick]')
        const form = this._parseJSFCLJS(buttonClassPage.attr('onclick'), $)
        if (form.postValues.idTurma === this._form.postValues.idTurma) {
          this._form = form
          return true
        }
      })
      if (!foundClass) {
        throw new Error('CLASS_NOT_FOUND')
      }
      return this._requestClassPageUsingForm()
    } else if (
      page.statusCode === 302 &&
      page.headers.location.includes('/sigaa/expirada.jsp')
    ) {
      throw new Error('ACCOUNT_SESSION_EXPIRED')
    } else {
      throw new Error(`SIGAA_UNEXPECTED_RESPONSE`)
    }
  }
  _requestClassPageUsingForm() {
    return this._post(this._form.action, this._form.postValues, {
      shareSameRequest: true
    }).then(
      (page) =>
        new Promise((resolve, reject) => {
          if (page.statusCode === 200) {
            if (page.body.includes('Comportamento Inesperado!')) {
              reject(new Error('INVALID_CLASS_ID'))
            }
            resolve(page)
          } else {
            reject(new Error(`SIGAA_UNEXPECTED_RESPONSE`))
          }
        })
    )
  }

  _requestClassPage() {
    return this._requestClassPageUsingForm().catch(() =>
      this._requestClassPageUsingId()
    )
  }

  getTopics() {
    return this._requestClassPage().then(
      (page) =>
        new Promise((resolve, reject) => {
          this._topics.forEach((topic) => {
            topic.finish()
            return false
          })
          this._videos = []
          this._topics = []
          const $ = Cheerio.load(page.body)
          const topicsElements = this._topicGetElements($)
          for (const topicElement of topicsElements) {
            const topicOptions = this._topicExtractor($, topicElement, page)
            const topic = new SigaaTopic(topicOptions)
            this._topics.push(topic)
          }
          resolve(this._topics)
        })
    )
  }

  _topicGetElements($) {
    const contentElement = $('#conteudo')
    let topicsElements
    if (contentElement) {
      topicsElements = contentElement.find('.topico-aula').toArray()
    } else {
      topicsElements = []
    }
    return topicsElements
  }

  _topicExtractor($, topicElement, page) {
    const topic = {}
    const titleElement = $(topicElement).find('.titulo')
    const titleFull = this._removeTagsHtml(titleElement.html())
    const topicDates = titleFull.slice(
      titleFull.lastIndexOf('(') + 1,
      titleFull.lastIndexOf(')')
    )
    if (topicDates.includes(' ')) {
      const startDate = topicDates.slice(0, topicDates.indexOf(' ')).split('/')
      topic.startDate = new Date(
        `${startDate[1]}/${startDate[0]}/${startDate[2]}`
      )
      const endDate = topicDates
        .slice(topicDates.lastIndexOf(' ') + 1)
        .split('/')
      topic.endDate = new Date(`${endDate[1]}/${endDate[0]}/${endDate[2]}`)
    } else {
      const dateString = topicDates.split('/')
      const date = new Date(
        `${dateString[1]}/${dateString[0]}/${dateString[2]}`
      )
      topic.startDate = date
      topic.endDate = date
    }
    topic.title = titleFull.slice(0, titleFull.lastIndexOf('(')).trim()
    const topicContentElement = $(topicElement).find('.conteudotopico')
    topic.contentText = decodeURI(
      this._removeTagsHtml(
        topicContentElement.html().replace(/<div([\S\s]*?)div>/gm, '')
      )
    )
    topic.attachments = this._parseAttachmentsFromTopic(
      $,
      topicContentElement,
      page
    )
    return topic
  }

  getFiles() {
    return this._getClassSubMenu('Arquivos').then((page) => {
      return new Promise((resolve, reject) => {
        const $ = Cheerio.load(page.body)

        const table = $('.listing')

        if (table.length === 0) resolve([])
        const rows = table.find('tr[class]').toArray()
        const usedFilesIndex = []
        for (const row of rows) {
          const cells = $(row).children()
          const title = this._removeTagsHtml(cells.first().html())
          const description = this._removeTagsHtml(cells.eq(1).html())

          const buttonElement = cells.eq(3).find('a[onclick]')
          const form = this._parseJSFCLJS(buttonElement.attr('onclick'), $)
          const id = form.postValues['id']
          const fileOptions = { title, description, form }
          const [files, index] = this._updateList(
            fileOptions,
            id,
            SigaaFile,
            this._files,
            this.getFiles.bind(this)
          )
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

  _parseAttachmentsFromTopic($, topicContentElement, page) {
    const topicAttachments = []
    const attachmentElements = topicContentElement
      .find('span[id] > div.item')
      .toArray()
    if (attachmentElements.length !== 0) {
      for (const attachmentElement of attachmentElements) {
        const iconElement = $(attachmentElement).find('img')
        const iconSrc = iconElement.attr('src')
        if (iconSrc.includes('questionario.png')) {
          const quizOptions = this._parseAttachmentQuiz($(attachmentElement), $)
          const id = quizOptions.id
          const [quizzes, index] = this._updateList(
            quizOptions,
            id,
            SigaaQuiz,
            this._quizzes,
            this.getQuizzes.bind(this)
          )
          this._quizzes = quizzes
          topicAttachments.push(this._quizzes[index])
        } else if (iconSrc.includes('video.png')) {
          const videoOptions = this._parseAtachmentVideo($(attachmentElement))
          this._videos.push(videoOptions)
          topicAttachments.push(videoOptions)
        } else if (iconSrc.includes('tarefa.png')) {
          const homeworkOptions = this._parseAttachmentHomework(
            $(attachmentElement),
            $
          )
          const id = homeworkOptions.id
          const [homeworks, index] = this._updateList(
            homeworkOptions,
            id,
            SigaaHomework,
            this._homeworks,
            this.getHomeworks.bind(this)
          )
          this._homeworks = homeworks
          topicAttachments.push(this._homeworks[index])
        } else if (iconSrc.includes('pesquisa.png')) {
          const surveyOptions = this._parseAttacmentSurvey(
            $(attachmentElement),
            $
          )
          const id = surveyOptions.id
          const [surveys, index] = this._updateList(
            surveyOptions,
            id,
            SigaaSurvey,
            this._surveys,
            this.getSurveys.bind(this)
          )
          this._surveys = surveys
          topicAttachments.push(this._surveys[index])
        } else if (iconSrc.includes('conteudo.png')) {
          const webContentOptions = this._parseAttachmentWebContent(
            $(attachmentElement),
            $
          )
          const id = webContentOptions.id
          const [webContents, index] = this._updateList(
            webContentOptions,
            id,
            SigaaWebContent,
            this._webContents,
            this.getWebContents.bind(this)
          )
          this._webContents = webContents
          topicAttachments.push(this._webContents[index])
        } else {
          const fileOptions = this._parseAttachmentFile($(attachmentElement), $)
          const id = fileOptions.id
          const [files, index] = this._updateList(
            fileOptions,
            id,
            SigaaFile,
            this._files,
            this.getFiles.bind(this)
          )
          this._files = files
          topicAttachments.push(this._files[index])
        }
      }
    }
    return topicAttachments
  }

  _parseAttachmentFile(attachmentElement, $) {
    const attachment = {}
    const titleElement = attachmentElement
      .find('span')
      .children()
      .first()
    attachment.title = this._removeTagsHtml(titleElement.html())
    attachment.form = this._parseJSFCLJS(titleElement.attr('onclick'), $)
    attachment.id = attachment.form.postValues.id
    const descriptionElement = attachmentElement.find('div.descricao-item')
    attachment.description = this._removeTagsHtml(descriptionElement.html())
    return attachment
  }

  _parseAttachmentWebContent(attachmentElement, $) {
    const attachment = {}
    const titleElement = attachmentElement
      .find('span')
      .children()
      .first()
    attachment.title = this._removeTagsHtml(titleElement.html())
    attachment.form = this._parseJSFCLJS(titleElement.attr('onclick'), $)
    attachment.id = attachment.form.postValues.id
    const descriptionElement = attachmentElement.find('div.descricao-item')
    attachment.description = this._removeTagsHtml(descriptionElement.html())
    return attachment
  }

  _parseAttacmentSurvey(attachmentElement, $) {
    const attachment = {}
    const titleElement = attachmentElement.find('span > a')
    attachment.title = this._removeTagsHtml(titleElement.html())
    attachment.form = this._parseJSFCLJS(titleElement.attr('onclick'), $)
    attachment.id = attachment.form.postValues.id
    return attachment
  }

  _parseAttachmentHomework(attachmentElement, $) {
    const attachment = {}
    const titleElement = attachmentElement.find('span > a')
    const form = this._parseJSFCLJS(titleElement.attr('onclick'), $)
    attachment.id = form.postValues.id
    attachment.title = this._removeTagsHtml(titleElement.html())
    const descriptionElement = attachmentElement.find('div.descricao-item')
    const description = this._removeTagsHtml(descriptionElement.html())
    const dates = this._parseDates(description)
    attachment.startDate = dates[0]
    attachment.endDate = dates[1]
    return attachment
  }

  _parseAtachmentVideo(attachmentElement) {
    const attachment = {}
    attachment.type = 'video'
    attachment.src = attachmentElement.find('iframe').attr('src')
    const titleElement = attachmentElement.find('span[id] > span[id]')
    attachment.title = this._removeTagsHtml(titleElement.html())
    const descriptionElement = attachmentElement.find('div.descricao-item')
    attachment.description = this._removeTagsHtml(descriptionElement.html())
    return attachment
  }

  _parseAttachmentQuiz(attachmentElement, $) {
    const attachment = {}
    const titleElement = attachmentElement.find('span > a')
    attachment.title = this._removeTagsHtml(titleElement.html())
    const form = this._parseJSFCLJS(titleElement.attr('onclick'), $)
    attachment.id = form.postValues.id
    const descriptionElement = attachmentElement.find('div.descricao-item')
    const description = this._removeTagsHtml(descriptionElement.html())
    const dates = this._parseDates(description)
    attachment.startDate = dates[0]
    attachment.endDate = dates[1]
    return attachment
  }

  getNews() {
    return this._getClassSubMenu('Notícias').then((page) => {
      return new Promise((resolve, reject) => {
        const $ = Cheerio.load(page.body)

        const table = $('.listing')

        if (table.length === 0) resolve([])
        const rows = table.find('tr[class]').toArray()
        if (this._news.length !== 0) {
          const usedNewsIndex = []

          for (const row of rows) {
            const cell = $(row).children()
            const title = this._removeTagsHtml(cell.first().html())
            const date = this._removeTagsHtml(cell.eq(1).html())

            const buttonElement = cell
              .eq(2)
              .children()
              .first()
            const form = this._parseJSFCLJS(buttonElement.attr('onclick'), $)
            const id = form.postValues.id
            const newsOptions = { title, date, form }
            const [news, index] = this._updateList(
              newsOptions,
              id,
              SigaaNews,
              this._news,
              this.getNews.bind(this)
            )
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
            const cell = $(row).children()
            const title = this._removeTagsHtml(cell.first().html())
            const date = this._removeTagsHtml(cell.eq(1).html())
            const buttonEl = cell
              .eq(2)
              .children()
              .first()
            const form = this._parseJSFCLJS(buttonEl.attr('onclick'), $)
            this._news.push(
              new SigaaNews(
                {
                  title,
                  date,
                  form
                },
                this.getNews.bind(this),
                this._sigaaSession
              )
            )
          }
          resolve(this._news)
        }
      })
    })
  }

  getAbsence() {
    return this._getClassSubMenu('Frequência').then(
      (page) =>
        new Promise((resolve, reject) => {
          const $ = Cheerio.load(page.body)
          const table = $('.listing')
          const absences = {
            list: []
          }
          if (table.length === 0) resolve(absences)
          const rows = table.find('tr[class]').toArray()
          for (const row of rows) {
            const cells = $(row).children()
            const date = this._removeTagsHtml(cells.first().html())
            const absenceString = this._removeTagsHtml(cells.eq(1).html())
            let absence
            if (absenceString === '' || absenceString === 'Não Informada') {
              continue
            } else if (absenceString === 'Presente') {
              absence = 0
            } else {
              absence = parseInt(absenceString.replace(/\D/gm, ''), 10)
            }
            absences.list.push({
              date: this._parseDates(date)[0],
              absence
            })
          }
          const details = this._removeTagsHtml($('.botoes-show').html()).split(
            '\n'
          )
          for (const detail of details) {
            if (detail.includes('Total de Faltas')) {
              absences.totalAbsences = parseInt(detail.replace(/\D/gm, ''), 10)
            } else if (detail.includes('Máximo de Faltas Permitido')) {
              absences.maxAbsences = parseInt(detail.replace(/\D/gm, ''), 10)
            }
          }
          resolve(absences)
        })
    )
  }

  async _getClassSubMenu(buttonLabel) {
    const classPage = await this._requestClassPage()
    const $ = Cheerio.load(classPage.body)
    const getBtnEl = $('div.itemMenu')
      .toArray()
      .find((buttonEl) => {
        return this._removeTagsHtml($(buttonEl).html()) === buttonLabel
      })
    const form = this._parseJSFCLJS(
      $(getBtnEl)
        .parent()
        .attr('onclick'),
      $
    )
    const menuPage = await this._post(form.action, form.postValues)
    return this._checkPageStatusCodeAndExpired(menuPage)
  }

  async _getRightSidebarCard($, cardTitle) {
    const titleElement = $('.rich-stglpanel-header.headerBloco')
      .toArray()
      .find((titleElement) => {
        return this._removeTagsHtml($(titleElement).html()) === cardTitle
      })
    if (!titleElement) {
      throw new Error('CARD_TITLE_NOT_FOUND')
    } else {
      return $(titleElement)
        .parent()
        .parent()
    }
  }

  async getExamCalendar() {
    const page = await this._requestClassPage()
    const $ = Cheerio.load(page.body)
    const card = await this._getRightSidebarCard($, 'Avaliações')
    const examElements = card.find('li').toArray()
    const examList = []
    const yearString = this.period.split('.')[0]
    const year = parseInt(yearString, 10)
    for (const examElement of examElements) {
      const exam = {}
      exam.description = this._removeTagsHtml(
        $(examElement)
          .find('span.descricao')
          .html()
      )
      const dateString = this._removeTagsHtml(
        $(examElement)
          .find('span.data')
          .html()
      )
      const dateStrings = dateString.match(/[0-9]+/g)
      if (dateStrings && dateStrings.length >= 2) {
        const monthIndex = parseInt(dateStrings[1], 10) - 1
        const day = parseInt(dateStrings[0], 10)
        if (dateStrings.length === 4) {
          const hours = parseInt(dateStrings[2], 10)
          const minutes = parseInt(dateStrings[3], 10)
          exam.date = new Date(year, monthIndex, day, hours, minutes)
        } else {
          exam.date = new Date(year, monthIndex, day)
        }
      } else {
        exam.date = null
      }
      examList.push(exam)
    }
    return examList
  }

  async getQuizzes() {
    const page = await this._getClassSubMenu('Questionários')
    return new Promise((resolve, reject) => {
      const $ = Cheerio.load(page.body)

      const table = $('.listing')

      if (table.length === 0) resolve([])
      const rows = table.find('tr[class]').toArray()
      const usedQuizzesIndex = []

      for (const row of rows) {
        const cells = row.find('td')
        const title = this._removeTagsHtml(cells.first().html())
        const startDate = this._removeTagsHtml(cells.eq(1).html())
        const endDate = this._removeTagsHtml(cells.eq(2).html())
        const dates = this._parseDates(`${startDate} ${endDate}`)
        const buttonSendAnswersElement = cells.eq(3).find('a[onclick]')
        let formSendAnswers = null
        if (buttonSendAnswersElement) {
          formSendAnswers = this._parseJSFCLJS(
            buttonSendAnswersElement.attr('onclick'),
            $
          )
        }
        const buttonViewAnswersSubmittedElement = cells.eq(4).find('a[onclick]')
        let formViewAnswersSubmitted = null
        if (buttonViewAnswersSubmittedElement) {
          formViewAnswersSubmitted = this._parseJSFCLJS(
            buttonViewAnswersSubmittedElement.attr('onclick'),
            $
          )
        }
        const form = formSendAnswers || formViewAnswersSubmitted
        const id = form.postValues.id

        const quizOptions = {
          title,
          startDate: dates[0],
          endDate: dates[1],
          id,
          formSendAnswers,
          formViewAnswersSubmitted
        }
        const [quizzes, index] = this._updateList(
          quizOptions,
          id,
          SigaaQuiz,
          this._quizzes,
          this.getQuizzes.bind(this)
        )
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

  async getWebContents() {
    const page = await this._getClassSubMenu('Conteúdo/Página web')
    return new Promise((resolve, reject) => {
      const $ = Cheerio.load(page.body)

      const table = $('.listing')

      if (table.length === 0) resolve([])
      const rows = table.find('tr[class]').toArray()
      const usedwebContentsIndex = []

      for (const row of rows) {
        const cells = row.find('td')
        const title = this._removeTagsHtml(cells.first().html())
        const dateString = this._removeTagsHtml(cells.eq(1).html())
        const date = this._parseDates(dateString)[0]
        const form = this._parseJSFCLJS(
          cells[2].find('a[onclick]').attr('onclick'),
          $
        )
        const id = form.postValues.id
        const webContentOptions = {
          title,
          date,
          form
        }

        const [webContents, index] = this._updateList(
          webContentOptions,
          id,
          SigaaWebContent,
          this._webContents,
          this.getWebContents.bind(this)
        )
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

  async getSurveys() {
    // TODO
  }

  async getHomeworks() {
    return this._getClassSubMenu('Tarefas').then((page) => {
      return new Promise((resolve, reject) => {
        const $ = Cheerio.load(page.body)

        const table = $('.listing')

        if (!table) resolve([])
        const rows = table.find('tr[class]').toArray()
        const usedHomeworksIndex = []

        for (let i = 0; i < rows.length; i += 2) {
          const cells = $(rows[i]).find('td')
          const cellDescription = $(rows[i + 1]).find('td')
          const title = this._removeTagsHtml(cells.eq(1).html())
          const description = this._removeTagsHtml(cellDescription.html())
          const date = this._removeTagsHtml(cells.eq(2).html())
          const dates = this._parseDates(date)
          let haveGrade = true
          if (this._removeTagsHtml(cells.eq(3).html()) === 'Não')
            haveGrade = false
          const buttonSendHomeworkElement = $(cells.eq(5).find('a[onclick]'))
          let formSendHomework = null
          if (buttonSendHomeworkElement.length !== 0) {
            formSendHomework = this._parseJSFCLJS(
              buttonSendHomeworkElement.attr('onclick'),
              $
            )
          }
          const buttonViewHomeworkSubmittedElement = $(
            cells.eq(6).find('a[onclick]')
          )
          let formViewHomeworkSubmitted = null
          if (buttonViewHomeworkSubmittedElement.length !== 0) {
            formViewHomeworkSubmitted = this._parseJSFCLJS(
              buttonViewHomeworkSubmittedElement.attr('onclick'),
              $
            )
          }
          const form = formSendHomework || formViewHomeworkSubmitted
          const id = form.postValues.id
          const homeworkOptions = {
            title,
            startDate: dates[0],
            endDate: dates[1],
            description,
            id,
            formSendHomework,
            formViewHomeworkSubmitted,
            haveGrade
          }

          const [homeworks, index] = this._updateList(
            homeworkOptions,
            id,
            SigaaHomework,
            this._homeworks,
            this.getHomeworks.bind(this)
          )
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

  _updateList(options, id, SigaaClass, classList, updateMethod) {
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

  async getMembers() {
    const page = await this._getClassSubMenu('Participantes')
    const $ = Cheerio.load(page.body)
    const tables = $('table.participantes').toArray()
    const tablesNames = $('fieldset').toArray()
    if (tables.length !== tablesNames.length) {
      throw new Error('SIGAA_MEMBERS_PAGE_INVALID')
    }
    let tableTeacher
    let tableStudent
    tablesNames.forEach((value, index) => {
      const label = this._removeTagsHtml($(value).html())
      if (label.includes('Professores')) tableTeacher = tables[index]
      else if (label.includes('Alunos')) tableStudent = tables[index]
    })
    const teachers = []
    if (tableTeacher) {
      const teacherElements = $(tableTeacher)
        .find('tr')
        .toArray()
      for (const teacherElement of teacherElements) {
        const teacher = {}
        const informationsString = $(teacherElement)
          .find('td[valign]')
          .html()
        const informations = informationsString.split('<br>').slice(1, -1)
        for (const information of informations) {
          const label = this._removeTagsHtml(
            information.match(/^[\s\S]*?(?=:[\s]*?<em>)/g)[0]
          )
          const informationContent = this._removeTagsHtml(
            information.match(/(?=<em>)[\s\S]*?(?=<\/em>)/g)[0]
          )
          switch (label) {
            case 'Departamento':
              teacher.department = informationContent
              break
            case 'Formação':
              teacher.formation = informationContent
              break
            case 'Usuário':
              teacher.username = informationContent
              break
            case 'E-mail':
            case 'E-Mail':
              teacher.email = informationContent
              break
            default:
              console.log(
                'WARNING:Teacher information label not recognized:' + label
              )
          }
        }
        const photoHREF = $(teacherElement)
          .find('img')
          .attr('src')
        const name = this._removeTagsHtml(
          $(teacherElement)
            .find('strong > a')
            .html()
        )
        let photoURL = new URL(photoHREF, page.url.href).href
        if (photoURL.includes('no_picture.png')) {
          photoURL = null
        }
        teacher.name = name
        teacher.photoURL = photoURL
        teachers.push(teacher)
      }
    }

    const students = []
    if (tableStudent) {
      const rows = $(tableStudent)
        .find('tr')
        .toArray()
      for (const row of rows) {
        const numberOfColumn = $(row).find('td[valign]').length
        for (let column = 0; column < numberOfColumn; column++) {
          const student = {}
          const informationsString = $(row)
            .find('td[valign]')
            .eq(column)
            .html()
          const informations = informationsString.split('<br>').slice(1)
          for (const information of informations) {
            const label = this._removeTagsHtml(
              information.match(/^[\s\S]*?(?=:[\s]*?<em>)/g)[0]
            )
            const informationContent = this._removeTagsHtml(
              information.match(/(?=<em>)[\s\S]*?(?=<\/em>)/g)[0]
            )
            switch (label) {
              case 'Matrícula': {
                student.registration = informationContent
                break
              }
              case 'Usuário': {
                student.username = informationContent
                break
              }
              case 'Curso': {
                student.course = informationContent
                break
              }
              case 'Data Matrícula': {
                const informationDateSplited = informationContent.split('-')
                const year = parseInt(informationDateSplited[2], 10)
                const month = parseInt(informationDateSplited[1], 10) - 1
                const day = parseInt(informationDateSplited[0], 10)
                student.registrationDate = new Date(year, month, day)
                break
              }
              case 'E-mail':
              case 'E-Mail': {
                student.email = informationContent
                break
              }
              default: {
                console.log(
                  'WARNING:Student information label not recognized:' + label
                )
              }
            }
          }
          const photoHREF = $(row)
            .find('td[width="47"] img')
            .eq(column)
            .attr('src')
          const name = this._removeTagsHtml(
            $(row)
              .find('strong')
              .eq(column)
              .html()
          )
          let photoURL = new URL(photoHREF, page.url.href).href
          if (photoURL.includes('no_picture.png')) {
            photoURL = null
          }
          student.name = name
          student.photoURL = photoURL
          students.push(student)
        }
      }
    }

    return {
      teachers,
      students
    }
  }

  async getGrades() {
    const page = await this._getClassSubMenu('Ver Notas')
    const getPositionByCellColSpan = ($, ths, cell) => {
      let i = 0
      for (const tr of ths.toArray()) {
        if (cell === tr) {
          return i
        }
        i += parseInt($(tr).attr('colspan') || 1, 10)
      }
      return false
    }

    const removeCellsWithName = ['', 'Matrícula', 'Nome', 'Sit.', 'Faltas']

    const $ = Cheerio.load(page.body)

    const table = $('table.tabelaRelatorio')
    if (table.length !== 1) {
      throw new Error('SIGAA_INVALID_RESPONSE')
    }

    const theadTrs = $('thead tr').toArray()
    const valueCells = $(table)
      .find('tbody tr')
      .children()
    if (valueCells.length === 0) {
      throw new Error('SIGAA_INVALID_RESPONSE')
    }
    const grades = []

    const theadElements = []
    for (const theadTr of theadTrs) {
      theadElements.push($(theadTr).find('th'))
    }

    for (let i = 0; i < theadElements[0].length; i++) {
      const gradeGroupName = this._removeTagsHtml(theadElements[0].eq(i).html())
      if (removeCellsWithName.indexOf(gradeGroupName) === -1) {
        const gradeGroup = {
          name: gradeGroupName
        }
        const index = getPositionByCellColSpan(
          $,
          theadElements[0],
          theadElements[0][i]
        )
        const theadElementColspan = parseInt(
          theadElements[0].eq(i).attr('colspan') || 1,
          10
        )
        if (theadElementColspan === 1) {
          let value = parseFloat(
            this._removeTagsHtml(valueCells.eq(index).html()).replace(/,/g, '.')
          )
          if (!value) value = null
          gradeGroup.value = value
        } else {
          gradeGroup.grades = []
          for (let j = index; j < index + theadElementColspan; j++) {
            const gradeId = theadElements[1]
              .eq(j)
              .attr('id')
              .slice(5)

            if (gradeId !== '') {
              const gradeName = $(`input#denAval_${gradeId}`).val()
              const gradeAbbreviation = $(`input#abrevAval_${gradeId}`).val()
              const gradeWeight = $(`input#pesoAval_${gradeId}`).val()
              let value = parseFloat(
                this._removeTagsHtml(valueCells.eq(j).html()).replace(/,/g, '.')
              )
              if (!value) value = null
              gradeGroup.grades.push({
                name: gradeName,
                abbreviation: gradeAbbreviation,
                weight: gradeWeight,
                value
              })
            } else {
              let average = parseFloat(
                this._removeTagsHtml(valueCells.eq(j).html()).replace(/,/g, '.')
              )
              if (!average) average = null
              gradeGroup.average = average
            }
          }
        }
        grades.push(gradeGroup)
      }
    }
    return grades
  }
  async getEducationPlan() {
    const page = await this._getClassSubMenu('Plano de Ensino')
    const $ = Cheerio.load(page.body)
    const tables = $('table.listagem').toArray()

    const response = {
      methodology: null,
      assessmentProcedures: null,
      attendanceSchedule: null,
      schedule: null,
      evaluations: null,
      basicReferences: null,
      supplementaryReferences: null
    }
    for (const table of tables) {
      const titleElement = $(table).find('caption')
      const title = this._removeTagsHtml(titleElement.html())

      const rows = $(table)
        .children('tbody')
        .children('tr')
        .toArray()
      switch (title) {
        case 'Metodologia de Ensino e Avaliação': {
          for (const row of rows) {
            const rowBodyElement = $(row).children('td')
            const body = this._removeTagsHtmlKeepingEmphasis(
              rowBodyElement.html()
            )
            const rowFieldElement = $(row).children('th')

            const rowField = this._removeTagsHtml(rowFieldElement.html())
            if (rowField === 'Metodologia:') {
              response.methodology = body
            } else if (
              rowField === 'Procedimentos de Avaliação da Aprendizagem:'
            ) {
              response.assessmentProcedures = body
            } else if (rowField === 'Horário de atendimento:') {
              response.attendanceSchedule = body
            } else {
              throw new Error('EDUCATION_PLAN_LABEL_NOT_FOUND')
            }
          }
          break
        }
        case 'Cronograma de Aulas': {
          const schedule = []
          for (const row of rows) {
            const scheduleDay = {}
            const startDateElement = $(row)
              .children('td')
              .eq(0)
            const endDateElement = $(row)
              .children('td')
              .eq(1)
            const bodyElement = $(row)
              .children('td')
              .eq(2)

            const endDateString = this._removeTagsHtml(endDateElement.html())
            if (endDateString) {
              const dates = this._parseDates(endDateString)
              if (dates.length > 0) {
                scheduleDay.endDate = dates[0]
              }
            } else {
              scheduleDay.date = null
            }

            const startDateString = this._removeTagsHtml(
              startDateElement.html()
            )
            if (startDateString) {
              const dates = this._parseDates(startDateString)
              if (dates.length > 0) {
                scheduleDay.startDate = dates[0]
              }
            } else {
              scheduleDay.date = null
            }

            const cellBodyText = this._removeTagsHtml(bodyElement.html())

            const bodyLastCharacter = cellBodyText.slice(-1)
            const lastCharacters = [';', '.', ':', ',']
            scheduleDay.body = lastCharacters.includes(bodyLastCharacter)
              ? cellBodyText.slice(0, -1)
              : cellBodyText

            schedule.push(scheduleDay)
          }
          response.schedule = schedule
          break
        }
        case 'Avaliações': {
          const evaluations = []
          for (const row of rows) {
            const evaluation = {}
            const dateElement = $(row)
              .children('td')
              .eq(0)

            const descriptionElement = $(row)
              .children('td')
              .eq(1)
            const dateString = this._removeTagsHtml(dateElement.html())
            if (dateString) {
              const dates = this._parseDates(dateString)
              if (dates.length > 0) {
                evaluation.date = dates[0]
              }
            } else {
              evaluation.date = null
            }

            const descriptionText = this._removeTagsHtml(
              descriptionElement.html()
            )

            const descriptionLastCharacter = descriptionText.slice(-1)
            const lastCharacters = [';', '.', ':', ',']
            evaluation.description = lastCharacters.includes(
              descriptionLastCharacter
            )
              ? descriptionText.slice(0, -1)
              : descriptionText
            evaluations.push(evaluation)
          }
          response.evaluations = evaluations

          break
        }
        case 'Referências Básicas':
        case 'Referências Complementares': {
          const references = []
          for (const row of rows) {
            const reference = {}
            const referenceTypeElement = $(row)
              .find('td')
              .eq(0)

            const referenceType = this._removeTagsHtml(
              referenceTypeElement.html()
            )
            reference.type = referenceType || null
            const descriptionElement = $(row)
              .children('td')
              .eq(1)

            const descriptionText = this._removeTagsHtmlKeepingEmphasis(
              descriptionElement.html()
            )
            const descriptionLastCharacter = descriptionText.slice(-1)
            const lastCharacters = [';', '.', ':', ',']
            reference.description = lastCharacters.includes(
              descriptionLastCharacter
            )
              ? descriptionText.slice(0, -1)
              : descriptionText
            references.push(reference)
          }
          if (title === 'Referências Básicas') {
            response.basicReferences = references
          } else if (title === 'Referências Complementares') {
            response.supplementaryReferences = references
          }

          break
        }
        default:
          console.log(
            'WARNING:Education plan table title not recognized:' + title
          )
      }
    }
    return response
  }
}

module.exports = SigaaClassStudent
