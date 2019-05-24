const SigaaAttachment = require("./sigaa-attachment");
('use strict');


class SigaaTopic {
    constructor(options, token) {
        if (!token) {
            throw "TOPIC_TOKEN_IS_NECESSARY"
        }
        this._token = token;
        if (options.name != undefined &&
            options.contentText != undefined &&
            options.attachments != undefined &&
            options.startDate != undefined &&
            options.endDate != undefined) {
            this._name = options.name
            this._contextText = options.contentText
            this._startDate = options.startDate
            this._attachments = this._constructorAttachments(options.attachments)
        } else {
            throw "INVALID_TOPIC"
        }
        
    }
    get name() {
        return this._name
    }
    get contentText() {
        return this._contextText
    }
    get attachments() {
        return this._attachments
    }
    _constructorAttachments(attachments) {
        let attachmentsClasses = []
        for (let attachment of attachments) {
            attachmentsClasses.push(new SigaaAttachment(attachment, this._token))
        }
        return attachmentsClasses;
    }
}

module.exports = SigaaTopic;