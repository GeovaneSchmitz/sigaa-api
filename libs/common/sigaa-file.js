const SigaaBase = require('./sigaa-base')
const fs = require('fs')
const fsPromises = require('fs').promises
const path = require('path')
const querystring = require('querystring')
const SigaaErrors = require('./sigaa-errors')
const SigaaSession = require('./sigaa-session')

/**
 * Class to manager file
 */
class SigaaFile extends SigaaBase {
  /**
   * There are two ways to create the class
   * the first is used the file's id and key
   * the second is used the file form
   *
   * @param {Object} options
   * @param {String} [options.id]
   * @param {String} [options.key]
   * @param {Object} [options.form]
   * @param {String} [options.title] file title
   * @param {Object} [options.description] file description
   * @param {Function} [fileUpdater] needed only if using options.form
   * @param {SigaaSession} sigaaSession
   * @throws {SigaaErrors.SIGAA_MORE_THAN_ONE_TYPE_OF_FILE_CONSTRUCTOR}
   */
  constructor(options, fileUpdater, sigaaSession) {
    super(sigaaSession)

    this.update(options)
    if (options.id || fileUpdater !== undefined) {
      this._updateFile = fileUpdater || null
    } else {
      throw new Error(SigaaErrors.SIGAA_FILE_UPDATE_IS_NECESSARY)
    }
  }

  get type() {
    return 'file'
  }

  update(options) {
    this._title = options.title || null
    this._description = options.description || null

    if (options.form !== undefined) {
      this._form = options.form
      this._id = options.form.postValues.id
      this._key = options.form.postValues.key
    } else if (options.id !== null && options.key !== null) {
      this._id = options.id
      this._key = options.key
    } else {
      throw new Error(SigaaErrors.SIGAA_INVALID_FILE_OPTIONS)
    }
    this._closed = false
  }

  get title() {
    this._checkIfItWasClosed()
    return this._title
  }

  get key() {
    this._checkIfItWasClosed()
    return this._key
  }

  get description() {
    this._checkIfItWasClosed()
    return this._description
  }

  get id() {
    this._checkIfItWasClosed()
    return this._id
  }

  close() {
    this._closed = true
  }

  _checkIfItWasClosed() {
    if (this._closed) {
      throw new Error(SigaaErrors.SIGAA_FILE_HAS_BEEN_FINISHED)
    }
  }
  async _fileParserResponse(response, destPath, destIsDirectory, callback) {
    return new Promise((resolve, reject) => {
      try {
        switch (response.statusCode) {
          case 200:
            try {
              if (this._form) {
                this._sigaaSession.reactivateCachePageByViewState(
                  this._form.postValues['javax.faces.ViewState']
                )
              }
              let filepath
              if (destIsDirectory) {
                if (response.headers['content-disposition']) {
                  const filename = response.headers['content-disposition']
                    .replace(/([\S\s]*?)filename="/gm, '')
                    .slice(0, -1)
                  filepath = path.join(destPath, filename)
                } else {
                  reject(new Error(SigaaErrors.SIGAA_FILE_DOWNLOAD_EXPIRED))
                }
              } else {
                filepath = destPath
              }

              const file = fs.createWriteStream(filepath)
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
  }

  _genDownloadHTTPOptions() {
    if (this._form) {
      const link = new URL(this._form.action)
      const options = this._makeRequestBasicOptions('POST', link)
      // this converts post parameters to string
      const postValuesString = querystring.stringify(this._form.postValues)
      // this inserts post parameters length to  header http
      options.headers['Content-Length'] = Buffer.byteLength(postValuesString)
      return [options, postValuesString]
    } else if (this._key !== undefined) {
      const link = new URL('/sigaa/verFoto', this._sigaaSession.url)
      link.searchParams.set('idArquivo', this._id)
      link.searchParams.set('key', this._key)
      return [
        this._makeRequestBasicOptions('GET', link, {
          withoutCookie: true
        })
      ]
    }
  }

  async download(basepath, callback, retry = true) {
    this._checkIfItWasClosed()
    try {
      const fileStats = await fsPromises.lstat(basepath)
      if (!(fileStats.isDirectory() || fileStats.isFile())) {
        throw new Error(SigaaErrors.SIGAA_FILE_PATH_NOT_EXISTS)
      }
      const options = this._genDownloadHTTPOptions()
      const response = await this._requestHTTP(...options)
      return await this._fileParserResponse(
        response,
        basepath,
        fileStats.isDirectory(),
        callback
      )
    } catch (err) {
      if (retry && this._updateFile) {
        await this._updateFile()
        return this.download(basepath, callback, false)
      } else {
        throw err
      }
    }
  }
}

module.exports = SigaaFile
