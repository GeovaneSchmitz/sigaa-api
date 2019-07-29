const SigaaBase = require('../common/sigaa-base')

const SigaaFile = require('./sigaa-file-student')
const SigaaHomework = require('./sigaa-homework-student')
const SigaaQuiz = require('./sigaa-quiz-student')
const SigaaSurvey = require('./sigaa-survey-student')
const SigaaVideo = require('./sigaa-video-student')
const SigaaWebContent = require('./sigaa-web-content-student')

class SigaaTopic extends SigaaBase {
  constructor (options, updateTopic, sigaaSession) {
    super(sigaaSession)

    this._attachmentsClasses = []

    if (updateTopic !== undefined) {
      this._updateTopic = updateTopic
    }
    this.update(options)
  }

  update (options) {
    if (options.name !== undefined &&
      options.contentText !== undefined &&
      options.attachments !== undefined &&
      options.startTimestamp !== undefined &&
      options.endTimestamp !== undefined &&
      options.attachments !== undefined) {
      this._name = options.name
      this._contextText = options.contentText
      this._startTimestamp = options.startTimestamp
      this._endTimestamp = options.endTimestamp
      this.updateAttachments(options.attachments)
      this._finish = false
    } else {
      throw new Error('INVALID_TOPIC')
    }
  }

  get name () {
    this._checkIfItWasFinalized()
    return this._name
  }

  get contentText () {
    this._checkIfItWasFinalized()
    return this._contextText
  }

  get endTimestamp () {
    this._checkIfItWasFinalized()
    return this._endTimestamp
  }

  get startTimestamp () {
    this._checkIfItWasFinalized()
    return this._startTimestamp
  }

  get attachments () {
    this._checkIfItWasFinalized()
    return this._attachmentsClasses
  }

  finish () {
    this._finish = true
    this._attachmentsClasses.forEach(attachment => {
      attachment.finish()
    })
  }

  _checkIfItWasFinalized () {
    if (this._finish) {
      throw new Error('TOPIC_HAS_BEEN_FINISHED')
    }
  }

  updateAttachments (attachments) {
    this._checkIfItWasFinalized()
    if (attachments === undefined) {
      return this._updateTopic()
    } else if (this._attachmentsClasses.length !== 0) {
      const usedAttachmentIndex = []

      for (const attachment of attachments) {
        const attachmentClassIndex = this._attachmentsClasses.findIndex((attachmentClass) => {
          return attachment.form.postOptions.id === attachmentClass.id
        })
        if (attachmentClassIndex === -1) {
          var attachmentClass = this.createAttachmentClass(attachment)
          this._attachmentsClasses.push(attachmentClass)
          usedAttachmentIndex.push(this._attachmentsClasses.length - 1)
        } else {
          this._attachmentsClasses[attachmentClassIndex].update(attachment)
          usedAttachmentIndex.push(attachmentClassIndex)
        }
      }
      this._attachmentsClasses = this._attachmentsClasses.filter((attachment, index) => {
        if (usedAttachmentIndex.indexOf(index) > -1) {
          return true
        } else {
          attachment.finish()
          return false
        }
      })
    } else {
      for (const attachment of attachments) {
        const attachmentClass = this.createAttachmentClass(attachment)
        this._attachmentsClasses.push(attachmentClass)
      }
    }
  }

  createAttachmentClass (attachment) {
    switch (attachment.type) {
      case 'file':
        var attachmentClass = new SigaaFile(attachment, this.updateAttachments.bind(this), this._sigaaSession)
        break
      case 'homework':
        attachmentClass = new SigaaHomework(attachment, this.updateAttachments.bind(this), this._sigaaSession)
        break
      case 'video':
        attachmentClass = new SigaaVideo(attachment, this.updateAttachments.bind(this), this._sigaaSession)
        break
      case 'survey':
        attachmentClass = new SigaaSurvey(attachment, this.updateAttachments.bind(this), this._sigaaSession)
        break
      case 'quiz':
        attachmentClass = new SigaaQuiz(attachment, this.updateAttachments.bind(this), this._sigaaSession)
        break
      case 'webContent':
        attachmentClass = new SigaaWebContent(attachment, this.updateAttachments.bind(this), this._sigaaSession)
        break
      default:
        throw new Error('TOPIC_ATTACHMENT_TYPE_NOT_SUPPORTED')
    }
    return attachmentClass
  }
}

module.exports = SigaaTopic
