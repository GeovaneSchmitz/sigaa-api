const Cheerio = require('cheerio')
const fs = require('fs')
const https = require('https')
const path = require('path')
const SigaaAccount = require('../common/sigaa-account')
const SigaaCourseStudent = require('./sigaa-course-student')
const SigaaErrors = require('../common/sigaa-errors')

/**
 * class to represent student account
 */
class SigaaAccountStudent extends SigaaAccount {
  /**
   * Get courses
   * @param {Boolean} [allPeriods=false] if true, all courses will be returned; otherwise, only current courses
   * @returns {Promise<Array<SigaaCourseStudent>>}
   * @async
   */
  getCourses(allPeriods) {
    return this._get('/sigaa/portais/discente/turmas.jsf').then(
      (page) =>
        new Promise((resolve, reject) => {
          const $ = Cheerio.load(page.body, {
            normalizeWhitespace: true
          })
          const table = $('.listagem')
          if (table.length === 0) resolve([])
          const listCourses = []
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
              const buttonCoursePage = cellElements.eq(5).find('a[onclick]')
              if (buttonCoursePage) {
                const courseData = {}
                const fullname = this._removeTagsHtml(cellElements.eq(0).html())
                courseData.title = fullname.slice(fullname.indexOf(' - ') + 3)
                courseData.code = fullname.slice(0, fullname.indexOf(' - '))
                courseData.numberOfStudents = this._removeTagsHtml(
                  cellElements.eq(2).html()
                )
                courseData.schedule = this._removeTagsHtml(
                  cellElements.eq(4).html()
                )
                courseData.period = period
                courseData.form = this._parseJSFCLJS(
                  buttonCoursePage.attr('onclick'),
                  $
                )
                courseData.id = courseData.form.postValues['idTurma']
                listCourses.push(
                  new SigaaCourseStudent(courseData, this._sigaaSession)
                )
              }
            }
          }
          resolve(listCourses)
        })
    )
  }
  /**
   * Get profile picture URL
   * @throws {SIGAA_USER_HAS_NO_PICTURE} If the user has no  picture
   * @throws {SIGAA_UNEXPECTED_RESPONSE} If receive a unexpected response
   * @returns {URL} URL of profile picture
   */
  async getProfilePictureURL() {
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

    return new URL(pictureSrc, this._sigaaSession.url)
  }

  /**
   * Download user profile picture, save in filepath
   * File path can be a directory
   * @param {String} basepath Path to save the image
   * @throws {SIGAA_USER_HAS_NO_PICTURE} If the user has no  picture
   * @throws {SIGAA_FILEPATH_NOT_EXISTS} If filepath isn't a directory or file
   * @throws {SIGAA_UNEXPECTED_RESPONSE} If receive a unexpected response
   * @returns {String} Full filepath of image
   */
  async downloadProfilePicture(basepath) {
    const pictureURL = await this.getProfilePictureURL()
    const fileStats = fs.lstatSync(basepath)
    if (!(fileStats.isDirectory() || fileStats.isFile())) {
      reject(new Error(SigaaErrors.SIGAA_FILEPATH_NOT_EXISTS))
    }
    const options = this._makeRequestBasicOptions('GET', pictureURL)

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

  /**
   * get user's name
   * @return {string}
   * @throws {SigaaErrors.SIGAA_SESSION_EXPIRED} If session has expired
   * @throws {igaaErrors.SIGAA_UNEXPECTED_RESPONSE} If receive a unexpected response
   */
  async getName() {
    const page = await this._get('/sigaa/portais/discente/discente.jsf')
    if (page.statusCode === 200) {
      const $ = Cheerio.load(page.body, {
        normalizeWhitespace: true
      })
      const username = this._removeTagsHtml($('p.usuario > span').html())
      return username
    } else if (page.statusCode === 302) {
      throw new Error(SigaaErrors.SIGAA_SESSION_EXPIRED)
    } else {
      throw new Error(SigaaErrors.SIGAA_UNEXPECTED_RESPONSE)
    }
  }
}

module.exports = SigaaAccountStudent
