const Cheerio = require('cheerio')

const SigaaBase = require('../common/sigaa-base')
const SigaaSession = require('../common/sigaa-session')
const SigaaErrors = require('../common/sigaa-errors')

const SigaaTopic = require('./sigaa-topic-student')
const SigaaNews = require('./sigaa-news-student')

const SigaaFile = require('./sigaa-file-student')
const SigaaHomework = require('./sigaa-homework-student')
const SigaaQuiz = require('./sigaa-quiz-student')
const SigaaSurvey = require('./sigaa-survey-student')
const SigaaClassForum = require('./sigaa-class-forum-student')
const SigaaClassScheduledChat = require('./sigaa-class-scheduled-chat-student')
const SigaaWebContent = require('./sigaa-web-content-student')

/**
 * School class in the student's view
 */
class SigaaClassStudent extends SigaaBase {
  /**
   * @param {SigaaSession} sigaaSession SigaaSession instance
   * @param {Object} options Class options
   * @param {String} options.title Class title
   * @param {String} options.id Class ID
   * @param {String} options.period Class period E.g. 2020.1
   * @param {String} [options.location] Classroom location
   * @param {String} [options.schedule] Class schedule in SIGAA notation
   * @param {String} [options.abbreviation] Class title abbreviation
   * @param {Object} options.form Class form POST to request class page
   * @param {String} options.form.action POST action URL
   * @param {Object} options.form.postValues Post values in format, key as field name, and value as field value.
   */
  constructor(options, sigaaSession) {
    super(sigaaSession)
    if (
      options.title !== undefined &&
      options.id !== undefined &&
      options.form !== undefined &&
      options.period !== undefined
    ) {
      this._title = options.title
      this._id = options.id
      this._form = options.form
      this._period = options.period
    } else {
      throw new Error(SigaaErrors.SIGAA_CLASS_MISSING_PARAMETERS)
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
    this._instances = {}
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
  /**
   * Request the class page using the class ID,
   * it is slower than requestClassPageUsingForm,
   * but works if the form is invalid
   * @throws {SigaaErrors.SIGAA_SESSION_EXPIRED} If session expired
   * @throws {SigaaErrors.SIGAA_UNEXPECTED_RESPONSE} If unexpeted response is received
   * @throws {SigaaErrors.SIGAA_CLASS_NOT_FOUND} If not found class with same ID
   * @return {<Promise>Object} response page
   * @private
   * @async
   */
  async _requestClassPageUsingId() {
    const page = await this._get('/sigaa/portais/discente/turmas.jsf')
    if (page.statusCode === 200) {
      const $ = Cheerio.load(page.body, {
        normalizeWhitespace: true
      })
      const table = $('.listagem')
      if (table.length === 0) {
        throw new Error(SigaaErrors.SIGAA_CLASS_NOT_FOUND)
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
        throw new Error(SigaaErrors.SIGAA_CLASS_NOT_FOUND)
      }
      return this._requestClassPageUsingForm()
    } else if (
      page.statusCode === 302 &&
      page.headers.location.includes('/sigaa/expirada.jsp')
    ) {
      throw new Error(SigaaErrors.SIGAA_SESSION_EXPIRED)
    } else {
      throw new Error(SigaaErrors.SIGAA_UNEXPECTED_RESPONSE)
    }
  }
  /**
   * Request the class page using the class POST Form,
   * it is faster than requestClassPageUsingId,
   * but don`t works if the form is invalid or expired
   * @private
   * @return {<Promise>Object} response page
   * @async
   * @throws {SigaaErrors.SIGAA_UNEXPECTED_RESPONSE} If Class page is invalid, the form probably expired.
   */
  async _requestClassPageUsingForm() {
    const page = await this._post(this._form.action, this._form.postValues, {
      shareSameRequest: true
    })
    if (page.statusCode === 200) {
      if (page.body.includes('Comportamento Inesperado!')) {
        throw new Error(SigaaErrors.SIGAA_UNEXPECTED_RESPONSE)
      }
      return page
    } else {
      throw new Error(SigaaErrors.SIGAA_UNEXPECTED_RESPONSE)
    }
  }
  /**
   * Request the class page using _requestClassPageUsingForm,
   * fallback to _requestClassPageUsingId
   * @private
   * @return {<Promise>Object} response page
   */
  _requestClassPage() {
    return this._requestClassPageUsingForm().catch(() =>
      this._requestClassPageUsingId()
    )
  }

  async getTopics() {
    const page = await this._requestClassPage()
    const $ = Cheerio.load(page.body)
    const topicsElements = this._topicGetElements($)
    const usedTopicsIds = []
    this._forumsIdIndex = 0
    this._closeClassInstances('topics', usedTopicsIds)
    for (const topicElement of topicsElements) {
      const topicOptions = this._topicParser($, topicElement, page)
      usedTopicsIds.push(topicOptions.id)
      this._updateClassInstances({
        instanceOptions: topicOptions,
        instanceId: topicOptions.id,
        Class: SigaaTopic,
        type: 'topics',
        updateMethod: this.getTopics.bind(this)
      })
    }
    this._closeClassInstances('topics', usedTopicsIds)
    return this._instances.topics
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

  _topicParser($, topicElement) {
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
    const attachments = this._parseAttachmentsFromTopic($, topicContentElement)
    const { texts, attachmentsWithoutText } = attachments.reduce(
      (reducer, attachment) => {
        if (attachment.type === 'text') {
          reducer.texts.push(attachment.body)
        } else {
          reducer.attachmentsWithoutText.push(attachment)
        }
        return reducer
      },
      { texts: [], attachmentsWithoutText: [] }
    )
    topic.contentText = [topic.contentText, ...texts].join('\n')
    topic.attachments = attachmentsWithoutText

    return topic
  }

  async getFiles() {
    const page = await this._getClassSubMenu('Arquivos')
    const $ = Cheerio.load(page.body)
    const table = $('.listing')
    const usedFilesId = []
    if (table.length !== 0) {
      const rows = table.find('tr[class]').toArray()
      for (const row of rows) {
        const cells = $(row).children()
        const title = this._removeTagsHtml(cells.first().html())
        const description = this._removeTagsHtml(cells.eq(1).html())
        const buttonElement = cells.eq(3).find('a[onclick]')
        const form = this._parseJSFCLJS(buttonElement.attr('onclick'), $)
        const id = form.postValues['id']
        const key = form.postValues['key']
        const fileOptions = { title, description, id, key }
        this._updateClassInstances({
          instanceOptions: fileOptions,
          instanceId: id,
          Class: SigaaFile,
          type: 'files',
          updateMethod: this.getFiles.bind(this)
        })
        usedFilesId.push(id)
      }
    }
    this._closeClassInstances('files', usedFilesId)
    return this._instances.files
  }

  _parseAttachmentsFromTopic($, topicContentElement) {
    const topicAttachments = []
    const attachmentElements = topicContentElement
      .find('span[id] > div.item')
      .toArray()
    if (attachmentElements.length !== 0) {
      for (const attachmentElement of attachmentElements) {
        const iconElement = $(attachmentElement).find('img')
        const iconSrc = iconElement.attr('src')
        if (iconSrc === undefined) {
          const attachmentText = {
            type: 'text',
            body: this._removeTagsHtml($(attachmentElement).html())
          }
          topicAttachments.push(attachmentText)
        } else if (iconSrc.includes('questionario.png')) {
          const quizOptions = this._parseAttachmentQuiz($, attachmentElement)
          const id = quizOptions.id
          const quiz = this._updateClassInstances({
            instanceId: id,
            instanceOptions: quizOptions,
            Class: SigaaQuiz,
            type: 'quizzes',
            updateMethod: this.getQuizzes.bind(this)
          })
          topicAttachments.push(quiz)
        } else if (iconSrc.includes('video.png')) {
          const videoOptions = this._parseAtachmentVideo($, attachmentElement)
          topicAttachments.push(videoOptions)
        } else if (iconSrc.includes('tarefa.png')) {
          const homeworkOptions = this._parseAttachmentHomework(
            $,
            attachmentElement
          )
          const id = homeworkOptions.id
          const homework = this._updateClassInstances({
            instanceId: id,
            instanceOptions: homeworkOptions,
            Class: SigaaHomework,
            type: 'homeworks',
            updateMethod: this.getHomeworks.bind(this)
          })
          topicAttachments.push(homework)
        } else if (iconSrc.includes('pesquisa.png')) {
          const surveyOptions = this._parseAttacmentSurvey($, attachmentElement)
          const id = surveyOptions.id
          const survey = this._updateClassInstances({
            instanceOptions: surveyOptions,
            instanceId: id,
            Class: SigaaSurvey,
            type: 'surveys',
            updateMethod: this.getSurveys.bind(this)
          })
          topicAttachments.push(survey)
        } else if (iconSrc.includes('conteudo.png')) {
          const webContentOptions = this._parseAttachmentGeneric(
            $,
            attachmentElement
          )
          const id = webContentOptions.id
          const webContents = this._updateClassInstances({
            instanceOptions: webContentOptions,
            instanceId: id,
            Class: SigaaWebContent,
            type: 'webContents',
            updateMethod: this.getWebContents.bind(this)
          })
          topicAttachments.push(webContents)
        } else if (iconSrc.includes('forumava.png')) {
          const forumOptions = this._parseAttachmentGeneric(
            $,
            attachmentElement
          )
          forumOptions.id = this._forumsIdIndex
          forumOptions.isMain = true
          this._forumsIdIndex++
          const forum = this._updateClassInstances({
            instanceOptions: forumOptions,
            Class: SigaaClassForum,
            instanceId: forumOptions.id,
            type: 'forums',
            updateMethod: this.getForums.bind(this)
          })
          topicAttachments.push(forum)
        } else if (iconSrc.includes('user_comment.png')) {
          const chatOptions = this._parseScheduledChat($, attachmentElement)
          const id = chatOptions.id
          const chat = this._updateClassInstances({
            instanceId: id,
            instanceOptions: chatOptions,
            Class: SigaaClassScheduledChat,
            type: 'scheduledChats',
            updateMethod: this.getScheduledChats.bind(this)
          })
          topicAttachments.push(chat)
        } else {
          const fileOptions = this._parseAttachmentGeneric($, attachmentElement)
          const id = fileOptions.id
          const file = this._updateClassInstances({
            instanceOptions: fileOptions,
            instanceId: id,
            Class: SigaaFile,
            type: 'files',
            updateMethod: this.getFiles.bind(this)
          })
          topicAttachments.push(file)
        }
      }
    }
    return topicAttachments
  }

  _parseAttachmentGeneric($, attachmentElement) {
    const attachment = {}
    const titleElement = $(attachmentElement)
      .find('span')
      .children()
      .first()
    attachment.title = this._removeTagsHtml(titleElement.html())
    attachment.form = this._parseJSFCLJS(titleElement.attr('onclick'), $)
    attachment.id = attachment.form.postValues.id
    const descriptionElement = $(attachmentElement).find('div.descricao-item')
    attachment.description = this._removeTagsHtml(descriptionElement.html())
    return attachment
  }
  _parseAttachmentForum($, attachmentElement) {
    const attachment = {}
    const titleElement = $(attachmentElement)
      .find('span')
      .children()
      .first()
    attachment.title = this._removeTagsHtml(titleElement.html())
    attachment.form = this._parseJSFCLJS(titleElement.attr('onclick'), $)
    attachment.id = attachment.form.postValues.id
    const descriptionElement = $(attachmentElement).find('div.descricao-item')
    attachment.description = this._removeTagsHtml(descriptionElement.html())
    return attachment
  }
  _parseAttacmentSurvey($, attachmentElement) {
    const attachment = {}
    const titleElement = $(attachmentElement).find('span > a')
    attachment.title = this._removeTagsHtml(titleElement.html())
    attachment.form = this._parseJSFCLJS(titleElement.attr('onclick'), $)
    attachment.id = attachment.form.postValues.id
    return attachment
  }

  _parseAttachmentHomework($, attachmentElement) {
    const attachment = {}
    const titleElement = $(attachmentElement).find('span > a')
    const form = this._parseJSFCLJS(titleElement.attr('onclick'), $)
    attachment.id = form.postValues.id
    attachment.title = this._removeTagsHtml(titleElement.html())
    const descriptionElement = $(attachmentElement).find('div.descricao-item')
    const description = this._removeTagsHtml(descriptionElement.html())
    const dates = this._parseDates(description)
    attachment.startDate = dates[0]
    attachment.endDate = dates[1]
    return attachment
  }

  _parseScheduledChat($, attachmentElement) {
    const attachment = {}

    const titleElement = $(attachmentElement).find('span > a')
    attachment.title = this._removeTagsHtml(titleElement.html())

    const onclick = titleElement.attr('onclick')
    attachment.id = onclick.match(/idchat=[0-9]*?&/g)[0].match(/[0-9]+/g)[0]

    const descriptionElement = $(attachmentElement).find('div.descricao-item')
    const description = this._removeTagsHtml(descriptionElement.html())
    const dates = this._parseDates(description)
    attachment.startDate = dates[0]
    attachment.endDate = dates[1]

    return attachment
  }

  _parseAtachmentVideo($, attachmentElement) {
    const attachment = {}
    attachment.type = 'video'

    const titleElement = $(attachmentElement).find('span[id] > span[id] a')
    const href = titleElement.attr('href')
    if (href) {
      const title = this._removeTagsHtml(titleElement.html())
      attachment.title = title.replace(/\(Link Externo\)$/g, '')
      attachment.src = href
    } else {
      const titleElement = $(attachmentElement).find('span[id] > span[id]')
      const title = this._removeTagsHtml(titleElement.html())
      attachment.title = title
      attachment.src = $(attachmentElement)
        .find('iframe')
        .attr('src')
    }

    const descriptionElement = $(attachmentElement).find('div.descricao-item')
    attachment.description = this._removeTagsHtml(descriptionElement.html())
    return attachment
  }

  _parseAttachmentQuiz($, attachmentElement) {
    const attachment = {}
    const titleElement = $(attachmentElement).find('span > a')
    attachment.title = this._removeTagsHtml(titleElement.html())
    const form = this._parseJSFCLJS(titleElement.attr('onclick'), $)
    attachment.id = form.postValues.id
    const descriptionElement = $(attachmentElement).find('div.descricao-item')
    const description = this._removeTagsHtml(descriptionElement.html())
    const dates = this._parseDates(description)
    attachment.startDate = dates[0]
    attachment.endDate = dates[1]

    return attachment
  }

  async getForums() {
    const page = await this._getClassSubMenu('Fóruns')
    const $ = Cheerio.load(page.body)
    const table = $('.listing')
    const usedForumIds = []
    if (table.length !== 0) {
      let forumsIdIndex = 0
      const rows = table.find('tr[class]').toArray()
      for (const row of rows) {
        const cells = $(row).children()
        const titleElement = cells.first().find('a')
        const title = this._removeTagsHtml(titleElement.html())
        const type = this._removeTagsHtml(cells.eq(1).html())
        const numOfTopics = parseInt(
          this._removeTagsHtml(cells.eq(2).html()),
          10
        )
        const author = this._removeTagsHtml(cells.eq(3).html())
        const date = this._removeTagsHtml(cells.eq(4).html())
        const form = this._parseJSFCLJS(titleElement.attr('onclick'), $)
        const id = forumsIdIndex
        forumsIdIndex++
        const forumOptions = {
          title,
          id,
          type,
          numOfTopics,
          author,
          date,
          form,
          isMain: true
        }
        this._updateClassInstances({
          instanceId: id,
          instanceOptions: forumOptions,
          Class: SigaaClassForum,
          type: 'forums',
          updateMethod: this.getForums.bind(this)
        })
        usedForumIds.push(id)
      }
    }
    this._closeClassInstances('forums', usedForumIds)
    return this._instances.news
  }

  async getNews() {
    const page = await this._getClassSubMenu('Notícias')
    const $ = Cheerio.load(page.body)
    const table = $('.listing')
    const usedNewsId = []
    if (table.length !== 0) {
      const rows = table.find('tr[class]').toArray()
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
        this._updateClassInstances({
          instanceId: id,
          instanceOptions: newsOptions,
          Class: SigaaNews,
          type: 'news',
          updateMethod: this.getNews.bind(this)
        })
        usedNewsId.push(id)
      }
    }
    this._closeClassInstances('news', usedNewsId)
    return this._instances.news
  }

  async getAbsence() {
    const page = await this._getClassSubMenu('Frequência')
    const $ = Cheerio.load(page.body)
    const table = $('.listing')
    const absences = {
      list: []
    }
    if (table.length === 0) return absences
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
    const details = this._removeTagsHtml($('.botoes-show').html()).split('\n')
    for (const detail of details) {
      if (detail.includes('Total de Faltas')) {
        absences.totalAbsences = parseInt(detail.replace(/\D/gm, ''), 10)
      } else if (detail.includes('Máximo de Faltas Permitido')) {
        absences.maxAbsences = parseInt(detail.replace(/\D/gm, ''), 10)
      }
    }
    return absences
  }

  async _getClassSubMenu(buttonLabel) {
    const classPage = await this._requestClassPage()
    const $ = Cheerio.load(classPage.body)

    const getBtnEl = $('div.itemMenu')
      .toArray()
      .find((buttonEl) => {
        return this._removeTagsHtml($(buttonEl).html()) === buttonLabel
      })
    if (!getBtnEl) {
      throw new Error(SigaaErrors.SIGAA_CLASS_SUB_MENU_NOT_FOUND)
    }
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
      throw new Error(SigaaErrors.SIGAA_TITLE_NOT_FOUND)
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
    const $ = Cheerio.load(page.body)

    const table = $('.listing')

    const usedQuizzesIds = []
    if (table.length !== 0) {
      const rows = table.find('tr[class]').toArray()

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
        this._updateClassInstances({
          instanceOptions: quizOptions,
          instanceId: id,
          Class: SigaaQuiz,
          type: 'quizzes',
          updateMethod: this.getQuizzes.bind(this)
        })
        usedQuizzesIds.push(id)
      }
      this._closeClassInstances('quizzes', usedQuizzesIds)
      return this._instances.quizzes
    }
  }

  async getWebContents() {
    const page = await this._getClassSubMenu('Conteúdo/Página web')
    const $ = Cheerio.load(page.body)

    const table = $('.listing')

    const usedWebContentsIds = []
    if (table.length !== 0) {
      const rows = table.find('tr[class]').toArray()

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

        this._updateClassInstances({
          instanceOptions: webContentOptions,
          instanceId: id,
          Class: SigaaWebContent,
          type: 'webContents',
          updateMethod: this.getWebContents.bind(this)
        })
        usedWebContentsIds.push(id)
      }
    }
    this._closeClassInstances('webContents', usedWebContentsIds)
    return this._instances.webContent
  }

  async getSurveys() {
    // TODO
  }

  async getScheduledChats() {
    let page
    try {
      page = await this._getClassSubMenu('Chats Agendados')
    } catch (err) {
      if (err.message === SigaaErrors.SIGAA_CLASS_SUB_MENU_NOT_FOUND) {
        throw new Error(
          SigaaErrors.SIGAA_SCHEDULED_CHAT_HAS_DISABLE_BY_INSTITUTION
        )
      }
    }
    const $ = Cheerio.load(page.body)

    const table = $('.listing')

    if (!table) resolve([])

    const rows = table.find('tr[class]').toArray()
    const usedChatIds = []

    for (const row of rows) {
      const cells = $(row).find('td')

      const cellTitle = cells
        .first()
        .find('a')
        .eq(0)
      const cellDescription = cells.first().find('p')

      const title = this._removeTagsHtml(cellTitle.html())
      const description = this._removeTagsHtml(cellDescription.html())

      const startDateString = this._removeTagsHtml(cells.eq(1).html())
      const endDateString = this._removeTagsHtml(cells.eq(2).html())
      const startDate = this._parseDates(startDateString)[0]
      const endDate = this._parseDates(endDateString)[0]

      const button = $(cells.eq(4).find('a[onclick]'))
      const form = this._parseJSFCLJS(button.attr('onclick'), $)
      const id = form.postValues.id
      usedChatIds.push(id)
      const chatOptions = {
        title,
        description,
        id,
        startDate,
        endDate
      }
      this._updateClassInstances({
        instanceOptions: chatOptions,
        instanceId: id,
        Class: SigaaClassScheduledChat,
        type: 'scheduledChats',
        updateMethod: this.getHomeworks.bind(this)
      })
    }
    this._closeClassInstances('scheduledChats', usedChatIds)
    return this._instances.scheduledChats
  }

  async getHomeworks() {
    const page = await this._getClassSubMenu('Tarefas')
    const $ = Cheerio.load(page.body)

    const table = $('.listing')

    if (!table) resolve([])
    const rows = table.find('tr[class]').toArray()
    const usedHomeworksIds = []

    for (let i = 0; i < rows.length; i += 2) {
      const cells = $(rows[i]).find('td')
      const cellDescription = $(rows[i + 1]).find('td')
      const title = this._removeTagsHtml(cells.eq(1).html())
      const description = this._removeTagsHtml(cellDescription.html())
      const date = this._removeTagsHtml(cells.eq(2).html())
      const dates = this._parseDates(date)
      let haveGrade = true
      if (this._removeTagsHtml(cells.eq(3).html()) === 'Não') haveGrade = false
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

      this._updateClassInstances({
        instanceOptions: homeworkOptions,
        instanceId: id,
        Class: SigaaHomework,
        type: 'homeworks',
        updateMethod: this.getHomeworks.bind(this)
      })
      usedHomeworksIds.push(id)
    }
    this._closeClassInstances('homeworks', usedHomeworksIds)
    return this._instances.homeworks
  }

  /**
   * Closes and removes the instance if not in idsToKeep
   * @param {String} type type of instance E.g topics, news, files.
   * @param {Array<String>} idsToKeep array with ids to keep E.g. ["1234", "4321"]
   */
  _closeClassInstances(type, idsToKeep) {
    if (this._instances[type] === undefined) {
      this._instances[type] = []
    } else {
      this._instances[type] = this._instances[type].filter((instance) => {
        try {
          if (idsToKeep.includes(instance.id)) {
            return true
          } else {
            instance.close()
            return false
          }
        } catch (err) {
          return false
        }
      })
    }
    return this._instances[type]
  }
  /**
   * Update instance with new information
   * If there is an instance with the ID equal to options.id and
   * the same type, the update method will be called with
   * instanceOptions
   * E.g. instance.update(options.instanceOptions)
   * or create new instance with instanceOptions, updateMethod and sigaaSession instance
   * E.g. new Class(instanceOptions, updateMethod, sigaaSession)
   * @param {Object} options
   * @param {Object} options.instanceOptions Object with new informations
   * @param {String} [options.instanceId] instance ID to find, or falsy value to creates new instance
   * @param {FunctionConstructor} options.Class class Constructor if no instance with id
   * @param {String} options.type type of instance E.g. files, topics, news,
   * @throws {SigaaErrors.SIGAA_TYPE_IS_NOT_A_VALID_VALUE} if type is not a string
   * @param {Function} options.updateMethod Function to be sent to the instance in the construction, this function will be called if the update is needed by the instance
   * @return {Any} return the instance updated/created
   */
  _updateClassInstances(options) {
    const { instanceOptions, instanceId, Class, type, updateMethod } = options
    if (typeof type !== 'string') {
      throw new Error(SigaaErrors.SIGAA_TYPE_IS_NOT_A_STRING)
    }
    if (this._instances[type] === undefined) {
      this._instances[type] = []
    }
    let instance = null
    if (instanceId !== undefined) {
      instance = this._instances[type].find((classItem) => {
        try {
          return instanceId === classItem.id
        } catch (err) {
          return false
        }
      })
    }
    if (!instance) {
      const newClass = new Class(
        instanceOptions,
        updateMethod,
        this._sigaaSession
      )
      this._instances[type].push(newClass)
      return newClass
    } else {
      instance.update(instanceOptions)
      return instance
    }
  }

  /**
   * Get members object
   * @async
   * @returns {Promise<object>}
   * @throws {SigaaErrors.SIGAA_UNEXPECTED_RESPONSE} If unexpeted response is received
   */
  async getMembers() {
    const page = await this._getClassSubMenu('Participantes')
    const $ = Cheerio.load(page.body)
    const tables = $('table.participantes').toArray()
    const tablesNames = $('fieldset').toArray()
    if (tables.length !== tablesNames.length) {
      throw new Error(SigaaErrors.SIGAA_UNEXPECTED_RESPONSE)
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

  /**
   * Get grades array
   * @throws {SigaaErrors.SIGAA_UNEXPECTED_RESPONSE} If unexpeted response is received
   * @returns {Promise<Array<object>>}
   * @async
   */
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
      throw new Error(SigaaErrors.SIGAA_UNEXPECTED_RESPONSE)
    }

    const theadTrs = $('thead tr').toArray()
    const valueCells = $(table)
      .find('tbody tr')
      .children()
    if (valueCells.length === 0) {
      throw new Error(SigaaErrors.SIGAA_UNEXPECTED_RESPONSE)
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

  /**
   * Get Education plan
   * @throws {SigaaErrors.SIGAA_UNEXPECTED_RESPONSE} If unexpeted response is received
   * @returns {Promise<object>}
   * @async
   */
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
              throw new Error(SigaaErrors.SIGAA_EDUCATION_PLAN_LABEL_NOT_FOUND)
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
