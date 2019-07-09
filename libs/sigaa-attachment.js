const SigaaBase = require("./sigaa-base")
const fs = require("fs")
const https = require("https")
const path = require("path")
const querystring = require("querystring");
('use strict');

class SigaaAttachment extends SigaaBase {
    constructor(options, updateAttachment, sigaaData) {
        super(sigaaData)
        this.update(options);
        if (updateAttachment != undefined){
            this._updateAttachment = updateAttachment
        }else{
            throw "ATTACHMENT_UPDATEATTACHMENT_IS_NECESSARY";
        }
    }
    update(options) {
        if (options.type != undefined &&
            options.title != undefined &&
            options.description != undefined &&
            options.form != undefined) {
            let validTypes = ['file', 'video', 'quiz', 'survey'];
            if (validTypes.indexOf(options.type) == -1) {
                throw "INVALID_ATTACHMENT_TYPE";
            }
            this._type = options.type;
            this._title = options.title;
            this._description = options.description;
            this._form = options.form;
            this._finish = false;
            if(this._awaitUpdate){
                this._awaitUpdate.bind(this)()
            }
        }
        else {
            throw "INVALID_ATTACHMENT_OPTIONS";
        }
    }

    get type() {
        this._checkIfItWasFinalized()
        return this._type;
    }
    get id(){
        this._checkIfItWasFinalized()
        return this._form.postOptions.id
    }
    finish(){
        this._finish = true;
    }
    _checkIfItWasFinalized(){
        if(this._finish){
            throw "ATTACHMENT_HAS_BEEN_FINISHED"
        }
    }
    downloadFile(basepath, cb, retry = true) {
        this._checkIfItWasFinalized()
        if (this.type == "file") {
            return  new Promise((resolve, reject) => {
                let file;
                let fileStats = fs.lstatSync(basepath)
                if (!(fileStats.isDirectory() || fileStats.isFile())) {
                    throw "PATH_NOT_EXISTS"
                }
                let link = new URL(this._form.action);
                let options = this._basicRequestOptions('POST', link, this._data.token)
                // this converts post parameters to string
                let postOptionsString = querystring.stringify(this._form.postOptions);
                // this inserts post parameters length to  header http

                options.headers['Content-Length'] = Buffer.byteLength(postOptionsString);

                // makes request
                var request = https.request(options, (response) => {
                    switch(response.statusCode){
                        case 200:
                            this._data.reactivateCachePageByViewState(this._form.postOptions['javax.faces.ViewState'])
                            let len =0
                            if (fileStats.isDirectory()) {
                                try{
                                    let filename = response.headers['content-disposition']
                                    .replace(/([\S\s]*?)filename=\"/gm, '').slice(0, -1);
                                    var filepath = path.join(basepath, filename)
                                }catch(e){
                                    throw "DOWNLOAD_EXPIRED"
                                }
                            }else{
                                var filepath = basepath
                            }
                            file = fs.createWriteStream(filepath);
                            response.pipe(file); //save to file

                            if(cb){
                                response.on("data", (chunk)=>{
                                    len += chunk.byteLength
                                    cb(len)
                                })
                            }
                        
                            file.on('finish', () => {
                                file.close((err) => {
                                    if (err) {
                                        fs.unlink(filepath, (err) => {
                                            if (err) reject(err.message);
                                            reject(false)
                                        });
                                    }
                                }); // close() is async, call resolve after close completes.
                                resolve(filepath)
                            });
                            response.on('error', (err) => {
                                file.close((err) => {
                                    if (err) {
                                        reject(err.message)
                                    }
                                });
                                fs.unlink(filepath, (err) => {
                                    if (err) reject(err.message)

                                });
                                reject(err.message)
                            });
                            file.on('error', (err) => {
                                file.close((err) => {
                                    if (err) {
                                        fs.unlink(filepath, (err) => {
                                            if (err) reject(err.message);
                                        });
                                        reject(err.message)
                                    }
                                });
                                fs.unlink(filepath, (err) => {
                                    if (err) reject(err.message);
                                });
                                reject(err.message)
                            });
                            break;
                        case 302:
                            if(retry){
                                this._updateAttachment()
                                this._awaitUpdate = () => {
                                    this._awaitUpdate = undefined;
                                    resolve(this.downloadFile(basepath, cb, false)                                    )
                                }
                            }else{
                                reject({
                                    status: 'ERROR',
                                    errorCode: 'DOWNLOAD_EXPIRED'
                                })
                            }
                            
                            break;
                        default:
                            reject({
                                status: 'ERROR',
                                errorCode: response.statusCode
                            })
                    }
                });
                request.write(postOptionsString); //send post parameters
                request.end();
            })
        } else {
            throw "ATTACHMENT_IS_NOT_A_FILE"
        }
    }
}

module.exports = SigaaAttachment;