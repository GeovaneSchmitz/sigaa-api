const Sigaa = require("./sigaa")
const fs = require("fs")
const https = require("https")
const path = require("path")
const querystring = require("querystring");
('use strict');

class SigaaAttachment extends Sigaa {
    constructor(options, token) {
        super()
        if (options.type != undefined &&
            options.title != undefined &&
            options.description != undefined &&
            options.form != undefined) {
            let validTypes = ['file', 'video', 'quiz', 'survey']
            if (validTypes.indexOf(options.type) == -1) {
                throw "INVALID_ATTACHMENT_TYPE"
            }
            this._type = options.type
            this._title = options.title
            this._description = options.description
            this._form = options.form
        } else {
            throw "INVALID_ATTACHMENT_OPTIONS"
        }
        if (!token) {
            throw "ATTACHMENT_TOKEN_IS_NECESSARY"
        }
        this._token = token;

    }
    get type() {
        return this._type;
    }
    downloadFile(basepath) {
        if (this.type == "file") {
            return new Promise((resolve, reject) => {
                let file;
                let fileStats = fs.lstatSync(basepath)
                if (!(fileStats.isDirectory() || fileStats.isFile())) {
                    throw "PATH_NOT_EXISTS"
                }
                let link = new URL(this._form.action);
                let options = this._basicRequestOptions('POST', link, this._token)
                // this converts post parameters to string
                let postOptionsString = querystring.stringify(this._form.postOptions);
                // this inserts post parameters length to  header http
                options.headers['Content-Length'] = Buffer.byteLength(postOptionsString);

                // makes request
                var request = https.request(options, (response) => {
                    if(response.statusCode === 200){
                        
                        if (fileStats.isDirectory()) {
                            let filename = response.headers['content-disposition']
                            .replace(/([\S\s]*?)filename=\"/gm, '').slice(0, -1);
                            var filepath = path.join(basepath, filename)
                        }else{
                            var filepath = basepath
                        }
                        file = fs.createWriteStream(filepath);
                        response.pipe(file); //save to file
                        file.on('finish', () => {
                            file.close((err) => {
                                if (err) {
                                    fs.unlink(filepath, (err) => {
                                        if (err) console.log(err.message);
                                        reject(false);
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
                    }else{
                        reject({
                            status: 'ERROR',
                            errorCode: res.statusCode
                        })
                    }
                });
                request.write(postOptionsString); //send post parameters
                request.end();
            });
        } else {
            throw "ATTACHMENT_IS_NOT_A_FILE"
        }
    }
}

module.exports = SigaaAttachment;