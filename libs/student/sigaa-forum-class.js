const SigaaBase = require('../common/sigaa-base')
const SigaaErrors = require('../common/sigaa-errors')
const SigaaFile = require('./sigaa-file-student')
const Cheerio = require('cheerio')
const FormData = require('formdata-node')

class SigaaForumClass extends SigaaBase {
  constructor(forumOptions, forumUpdate, sigaaSession) {
    super(sigaaSession)
    this.update(forumOptions)
    if (forumUpdate !== undefined) {
      this._updateForum = forumUpdate
    } else {
      throw new Error(SigaaErrors.SIGAA_FORUM_UPDATE_IS_NECESSARY)
    }
  }

  update(forumOptions) {
    if (
      forumOptions.title !== undefined &&
      forumOptions.form !== undefined &&
      forumOptions.id !== undefined &&
      (forumOptions.isMain === false || forumOptions.isMain === true)
    ) {
      this._title = forumOptions.title
      this._form = forumOptions.form
      this._id = forumOptions.id
      this._isMain = forumOptions.isMain
    } else {
      throw new Error(SigaaErrors.SIGAA_INVALID_FORUM_OPTIONS)
    }

    if (forumOptions.type !== undefined) {
      this._forumType = forumOptions.type
    }
    if (forumOptions.numOfTopics !== undefined) {
      this._numOfTopics = forumOptions.numOfTopics
    }
    if (forumOptions.author !== undefined) {
      this._author = forumOptions.author
    }
    if (forumOptions.date !== undefined) {
      this._date = forumOptions.date
    }
  }

  async getTopicResponses() {
    if (this.isMain) {
      const page = await this._awaitForumPage()
    }
  }

  async _requestUpdate() {
    if (!this._updatePromise) {
      this._updatePromise = this._updateForum()
      this._updatePromise.finally(() => {
        this._updatePromise = null
      })
    }
    return this._updatePromise
  }

  get isMain() {
    return this._isMain
  }

  async _awaitForumPage() {
    if (!this._fullForumPromise) {
      this._fullForumPromise = this._getForumPage()
      this._fullForumPromise.finally(() => {
        this._fullForumPromise = null
      })
    }
    return this._fullForumPromise
  }

  get title() {
    this._checkIfItWasClosed()
    return this._title
  }
  get id() {
    this._checkIfItWasClosed()
    return this._id
  }
  get type() {
    return 'forum'
  }
  async getForumType() {
    this._checkIfItWasClosed()
    if (this._forumType === undefined) {
      await this._awaitForumPage()
    }
    return this._forumType
  }
  async getDescription() {
    this._checkIfItWasClosed()
    if (this._description === undefined) {
      await this._awaitForumPage()
    }
    return this._description
  }
  async getAuthor() {
    this._checkIfItWasClosed()
    if (this._author === undefined) {
      await this._awaitForumPage()
    }
    return this._author
  }

  async getFile() {
    this._checkIfItWasClosed()
    if (this._file === undefined) {
      await this._awaitForumPage()
    }
    return this._file
  }
  async getNumOfTopics() {
    this._checkIfItWasClosed()
    if (this._numOfTopics === undefined) {
      await this._requestUpdate()
    }
    return this._numOfTopics
  }
  /**
   * Post topic in forum
   * @param {string} title title of topic
   * @param {string} body body of topic
   * @param {Buffer} file buffer of file attachment
   * @param {boolean} notify if notify members
   */
  async postTopic(title, body, file, notify) {
    if (!title || typeof title !== 'string') {
      throw new Error(SigaaErrors.SIGAA_FORUM_TITLE_IS_INVALID)
    }
    if (!body || typeof body !== 'string') {
      throw new Error(SigaaErrors.SIGAA_FORUM_BODY_IS_INVALID)
    }
    if (!this._submitTopicPageForm) {
      await this._awaitForumPage()
    }
    const page = await this._post(
      this._submitTopicPageForm.action,
      this._submitTopicPageForm.postValues
    )
    const $ = Cheerio.load(page.body, {
      normalizeWhitespace: true
    })
    const formElement = $('form#form')
    const action = new URL(formElement.attr('action'), page.url.href)

    const inputHiddens = formElement
      .find('form#form input[type="hidden"]')
      .toArray()
    const fileInput = formElement.find('input[type="file"]')
    const submitButton = formElement.find('input[name="form:btnSalvar"]')
    const notifyCheckbox = formElement.find('input[type="checkbox"]')
    if (
      inputHiddens.length === 0 ||
      submitButton.length !== 1 ||
      notifyCheckbox.length !== 1 ||
      fileInput.length !== 1
    ) {
      throw new Error(SigaaErrors.SIGAA_UNEXPECTED_RESPONSE)
    }
    const formData = new FormData()
    for (const input of inputHiddens) {
      formData.set($(input).attr('name'), $(input).val())
    }
    if (file) {
      formData.set(fileInput.attr('name'), file)
    }
    if (notify) {
      formData.set(notifyCheckbox.attr('name'), 'on')
    }
    formData.set('form:assunto', title)
    formData.set('form:mensagem', body)
    formData.set($(submitButton).attr('name'), $(submitButton).val())
    const responsePage = await this._postMultipart(action, formData)
    return responsePage.body.includes(
      'Opera&#231;&#227;o realizada com sucesso!'
    )
  }
  async getCreationDate() {
    this._checkIfItWasClosed()
    if (this._creationDate === undefined) {
      await this._awaitForumPage()
    }
    return this._creationDate
  }

  async getMonitorReading() {
    this._checkIfItWasClosed()
    if (this._monitorReading === undefined) {
      await this._awaitForumPage()
    }
    return this._monitorReading
  }

  _checkIfItWasClosed() {
    if (this._close) {
      throw new Error(SigaaErrors.SIGAA_FORUM_HAS_BEEN_FINISHED)
    }
  }

  close() {
    this._close = true
  }

  async _getForumPage(retry = true) {
    try {
      const page = await this._post(this._form.action, this._form.postValues)
      const $ = Cheerio.load(page.body, {
        normalizeWhitespace: true
      })
      this._parseForumTable($)
      this._parseSubmitPageForm($, page)
    } catch (err) {
      if (retry) {
        await this._updateForum()
        return this._getForumPage(false)
      } else {
        throw err
      }
    }
  }

  _parseSubmitPageForm($, page) {
    const formElement = $('form#form')
    const action = new URL(formElement.attr('action'), page.url.href).href
    const postValues = {}
    formElement.find("input:not([type='button'])").each(function() {
      postValues[$(this).attr('name')] = $(this).val()
    })

    this._submitTopicPageForm = {
      action,
      postValues
    }
  }

  _parseForumTable($) {
    const tableElement = $('table.formAva > tbody')
    if (tableElement.length === 0) {
      throw new Error(SigaaErrors.SIGAA_UNEXPECTED_RESPONSE)
    }
    const rows = tableElement.find('tr').toArray()
    for (const row of rows) {
      const headCellElement = $(row).find('th')
      const dataCellElement = $(row).find('td')
      const label = this._removeTagsHtml(headCellElement.html())
      const content = this._removeTagsHtml(dataCellElement.html())
      switch (label) {
        case 'Título:': {
          this._title = content
          break
        }
        case 'Descrição:': {
          this._description = content
          break
        }
        case 'Autor(a):': {
          this._author = content
          break
        }
        case 'Arquivo:': {
          const linkElement = $(dataCellElement).find('a')
          if (linkElement.length === 1) {
            const title = this._removeTagsHtml(linkElement.html())
            const form = this._parseJSFCLJS(linkElement.attr('onclick'), $)
            const fileObj = {
              title,
              description: '',
              form
            }
            if (this._file) {
              this._file.update(fileObj)
            } else {
              this._file = new SigaaFile(
                fileObj,
                this._awaitForumPage.bind(this),
                this._sigaaSession
              )
            }
          } else {
            this._file = null
          }
          break
        }
        case 'Monitorar Leitura:': {
          if (content === 'SIM') {
            this._monitorReading = true
          } else {
            this._monitorReading = false
          }
          break
        }
        case 'Tipo:': {
          this._forumType = content
          break
        }
        case 'Ordenação Padrão:': {
          //TODO
          break
        }
        case 'Criado em:': {
          const dates = this._parseDates(content)
          this._creationDate = dates[0]
          break
        }
        default: {
          console.log('WARNING:forum label not recognized:' + label)
        }
      }
    }
  }
}

module.exports = SigaaForumClass
