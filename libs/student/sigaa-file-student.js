const SigaaBase = require('../common/sigaa-base')
const fs = require('fs')
const https = require('https')
const path = require('path')
const querystring = require('querystring')
const SigaaErrors = require('../common/sigaa-errors')
/**
 * file Class
 */
class SigaaFile extends SigaaBase {
  constructor(options, fileUpdater, sigaaSession) {
    super(sigaaSession)
    this.update(options)
    if (fileUpdater !== undefined) {
      this._updateFile = fileUpdater
    } else {
      throw new Error(SigaaErrors.SIGAA_FILE_UPDATE_IS_NECESSARY)
    }
  }

  get type() {
    return 'file'
  }

  update(options) {
    if (
      options.title !== undefined &&
      options.description !== undefined &&
      options.form !== undefined
    ) {
      this._title = options.title
      this._description = options.description
      this._form = options.form
      this._closed = false
    } else {
      throw new Error(SigaaErrors.SIGAA_INVALID_FILE_OPTIONS)
    }
  }

  get title() {
    this._checkIfItWasClosed()
    return this._title
  }

  get description() {
    this._checkIfItWasClosed()
    return this._description
  }

  get id() {
    this._checkIfItWasClosed()
    return this._form.postValues.id
  }

  close() {
    this._closed = true
  }

  _checkIfItWasClosed() {
    if (this._closed) {
      throw new Error(SigaaErrors.SIGAA_FILE_HAS_BEEN_FINISHED)
    }
  }

  async download(basepath, callback, retry = true) {
    this._checkIfItWasClosed()
    try {
      let file
      const fileStats = fs.lstatSync(basepath)
      if (!(fileStats.isDirectory() || fileStats.isFile())) {
        throw new Error(SigaaErrors.SIGAA_FILE_PATH_NOT_EXISTS)
      }
      const link = new URL(this._form.action)
      const options = this._makeRequestBasicOptions('POST', link)
      // this converts post parameters to string
      const postValuesString = querystring.stringify(this._form.postValues)
      // this inserts post parameters length to  header http

      options.headers['Content-Length'] = Buffer.byteLength(postValuesString)
      const response = await this._requestHTTP(options, postValuesString)
      return await new Promise((resolve, reject) => {
        try {
          switch (response.statusCode) {
            case 200:
              try {
                this._sigaaSession.reactivateCachePageByViewState(
                  this._form.postValues['javax.faces.ViewState']
                )
                let filepath
                if (fileStats.isDirectory()) {
                  if (response.headers['content-disposition']) {
                    const filename = response.headers['content-disposition']
                      .replace(/([\S\s]*?)filename="/gm, '')
                      .slice(0, -1)
                    filepath = path.join(basepath, filename)
                  } else {
                    reject(new Error(SigaaErrors.SIGAA_FILE_DOWNLOAD_EXPIRED))
                  }
                } else {
                  filepath = basepath
                }

                file = fs.createWriteStream(filepath)
                response.bodyStream.pipe(file) // save to file

                if (callback) {
                  response.bodyStream.on('data', () => {
                    callback(file.bytesWritten)
                  })
                }

                file.on('finish', () => {
                  file.close() // close() is async, call resolve after close completes.
                  resolve(filepath)
                })

                response.bodyStream.on('error', (err) => {
                  file.close()
                  fs.unlinkSync(filepath)
                  reject(err)
                })
                file.on('error', (err) => {
                  file.close()
                  fs.unlinkSync(filepath)
                  reject(err)
                })
              } catch (err) {
                reject(err)
              }
              break
            case 302:
              reject(new Error(SigaaErrors.SIGAA_FILE_DOWNLOAD_EXPIRED))
              break
            default:
              reject(new Error(SigaaErrors.SIGAA_UNEXPECTED_RESPONSE))
          }
        } catch (err) {
          reject(err)
        }
      })
    } catch (err) {
      if (retry) {
        return this._updateFile().then(() =>
          this.download(basepath, callback, false)
        )
      } else {
        throw err
      }
    }
  }
}

module.exports = SigaaFile
