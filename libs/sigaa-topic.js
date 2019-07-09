const SigaaAttachment = require("./sigaa-attachment");
const SigaaBase = require("./sigaa-base");

('use strict');


class SigaaTopic extends SigaaBase {
  constructor(options, updateTopic, sigaaData) {
    super(sigaaData)

    this._attachmentsClasses = []

    if (updateTopic != undefined) {
      this._updateTopic = updateTopic;
    }
    this.update(options);

  }
  update(options) {
    if (options.name != undefined &&
      options.contentText != undefined &&
      options.attachments != undefined &&
      options.startDate != undefined &&
      options.endDate != undefined &&
      options.attachments != undefined) {
      this._name = options.name;
      this._contextText = options.contentText;
      this._startDate = options.startDate;
      this._endDate = options.endDate;
      this.updateAttachments(options.attachments);
      this._finish = false;
    }
    else {
      throw "INVALID_TOPIC";
    }
  }

  get name() {
    this._checkIfItWasFinalized()
    return this._name
  }
  get contentText() {
    this._checkIfItWasFinalized()
    return this._contextText
  }
  get attachments() {
    this._checkIfItWasFinalized()
    return this._attachmentsClasses
  }
  get startDate() {
    this._checkIfItWasFinalized()
    return this._startDate
  }
  get endDate() {
    this._checkIfItWasFinalized()
    return this._endDate
  }
  finish() {
    this._finish = true;
    this._attachmentsClasses.forEach(attachment => {
      attachment.finish()
    })
  }
  _checkIfItWasFinalized() {
    if (this._finish) {
      throw "TOPIC_HAS_BEEN_FINISHED"
    }
  } 
       

  updateAttachments(attachments) {
    this._checkIfItWasFinalized()
    if (attachments == undefined) {
      return this._updateTopic()
    } else if (this._attachmentsClasses.length !== 0) {
      let usedAttachmentIndex = []

      for (let attachment of attachments) {
        let attachmentClassIndex = this._attachmentsClasses.findIndex((attachmentClass) => {
          return attachment.form.postOptions.id == attachmentClass.id
        })
        if (attachmentClassIndex == -1) {
          let attachmentClass = new SigaaAttachment(attachment, this.updateAttachments.bind(this), this._data)
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
      for (let attachment of attachments) {
        let attachmentClass = new SigaaAttachment(attachment, this.updateAttachments.bind(this), this._data)
        this._attachmentsClasses.push(attachmentClass)
      }
    }
  }
}

module.exports = SigaaTopic;