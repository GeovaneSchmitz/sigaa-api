const Cheerio = require('cheerio')
const fs = require('fs')
const https = require('https')
const path = require('path')
const SigaaAccount = require('../common/sigaa-account')
const SigaaClassStudent = require('./sigaa-class-student')
const SigaaErrors = require('../common/sigaa-errors')
class SigaaAccountStudent extends SigaaAccount {
  /**
   * Get all classes
   * @param {Boolean} [allPeriods=false]
   * @returns {Promise.<Array.<SigaaClassStudent>>}
   * @async
   */
  getClasses(allPeriods) {
    return this._get('/sigaa/portais/discente/turmas.jsf').then(
      (page) =>
        new Promise((resolve, reject) => {
          const $ = Cheerio.load(page.body, {
            normalizeWhitespace: true
          })
          const table = $('.listagem')
          if (table.length === 0) resolve([])
          const listClasses = []
          let period
          let rows = table.find('tbody > tr').toArray()
          if (!allPeriods) {
            let lastPeriodIndex
            for (let i = 0; i < rows.length; i++) {
              const cellElements = $(rows[i]).find('td')
              if (cellElements.eq(0).hasClass('periodo')) {
                lastPeriodIndex = i
              }
            }
            rows = rows.slice(lastPeriodIndex)
          }
          for (const row of rows) {
            const cellElements = $(row).find('td')
            if (cellElements.eq(0).hasClass('periodo')) {
              period = this._removeTagsHtml(cellElements.html())
            } else if (period) {
              const buttonClassPage = cellElements.eq(5).find('a[onclick]')
              if (buttonClassPage) {
                const classData = {}
                const fullname = this._removeTagsHtml(cellElements.eq(0).html())
                classData.title = fullname.slice(fullname.indexOf(' - ') + 3)
                classData.abbreviation = fullname.slice(
                  0,
                  fullname.indexOf(' - ')
                )
                classData.numberOfStudents = this._removeTagsHtml(
                  cellElements.eq(2).html()
                )
                classData.schedule = this._removeTagsHtml(
                  cellElements.eq(4).html()
                )
                classData.period = period
                classData.form = this._parseJSFCLJS(
                  buttonClassPage.attr('onclick'),
                  $
                )
                classData.id = classData.form.postValues['idTurma']
                listClasses.push(
                  new SigaaClassStudent(classData, this._sigaaSession)
                )
              }
            }
          }
          resolve(listClasses)
        })
    )
  }
  /**
   * Download user profile picture, save in filepath
   * File path can be a directory
   * @param {String} basepath Path to save the image
   * @returns {String} Full filepath of image
   * @throws {SIGAA_USER_HAS_NO_PICTURE} If the user has no  picture
   * @throws {SIGAA_FILEPATH_NOT_EXISTS} If filepath isn't a directory or file
   * @throws {SIGAA_UNEXPECTED_RESPONSE} If receive a unexpected response
   */
  async downloadProfilePicture(basepath) {
    const page = await this._get('/sigaa/mobile/touch/menu.jsf').then(
      (page) => {
        return this._checkPageStatusCodeAndExpired(page)
      }
    )
    const $ = Cheerio.load(page.body, {
      normalizeWhitespace: true
    })
    const pictureElement = $('div[data-role="fieldcontain"] img')
    if (pictureElement.length === 0) {
      throw new Error(SigaaErrors.SIGAA_USER_HAS_NO_PICTURE)
    }
    const pictureSrc = pictureElement.attr('src')
    if (pictureSrc.includes('/img/avatar.jpg')) {
      throw new Error(SigaaErrors.SIGAA_USER_HAS_NO_PICTURE)
    }
    const fileStats = fs.lstatSync(basepath)
    if (!(fileStats.isDirectory() || fileStats.isFile())) {
      reject(new Error(SigaaErrors.SIGAA_FILEPATH_NOT_EXISTS))
    }
    const pictureURL = new URL(pictureSrc, this._sigaaSession.url)
    const options = this._makeRequestBasicOptions('GET', pictureURL)

    // makes request
    return new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(SigaaErrors.SIGAA_UNEXPECTED_RESPONSE))
        }
        try {
          let filepath
          if (fileStats.isDirectory()) {
            if (response.headers['content-disposition']) {
              const filename = response.headers['content-disposition']
                .replace(/([\S\s]*?)filename="/gm, '')
                .slice(0, -1)
              const contentType = response.headers['content-type']
              let extension
              switch (contentType) {
                case 'image/png':
                  extension = '.png'
                  break
                case 'image/jpeg':
                  extension = '.jpg'
                  break
                case 'image/gif':
                  extension = '.gif'
                  break
                default:
                  extension = ''
              }
              filepath = path.join(basepath, filename + extension)
            } else {
              reject(new Error(SigaaErrors.SIGAA_UNEXPECTED_RESPONSE))
            }
          } else {
            filepath = basepath
          }

          const file = fs.createWriteStream(filepath)
          response.pipe(file) // save to file

          file.on('finish', () => {
            file.close() // close() is async, call resolve after close completes.
            resolve(filepath)
          })
          response.on('error', (err) => {
            file.close(file)
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
      })
      request.end()
    })
  }

  async getUsername() {
    const page = await this._get('/sigaa/portais/discente/discente.jsf')
    if (page.statusCode === 200) {
      const $ = Cheerio.load(page.body, {
        normalizeWhitespace: true
      })
      const username = this._removeTagsHtml($('p.usuario > span').html())
      return username
    } else if (page.statusCode === 302) {
      throw new Error('SESSION_EXPIRED')
    } else {
      throw new Error(`SIGAA_UNEXPECTED_RESPONSE`)
    }
  }
}

module.exports = SigaaAccountStudent
