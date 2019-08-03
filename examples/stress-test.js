const Sigaa = require('..')
const fs = require('fs')
const path = require('path')

const sigaa = new Sigaa({
  urlBase: 'https://sigaa.ifsc.edu.br'
})

// put your crendecias
var username = ''
var password = ''

const BaseDestiny = path.join('.', 'downloads')

// this creates BaseDestiny
fs.mkdir(BaseDestiny, err => {
  if (err && err.code !== 'EEXIST') throw new Error('up')
})

let account

sigaa.login(username, password) // login
  .then(sigaaAccount => {
    account = sigaaAccount
    return account.getAllClasses() // this return a array with all current classes
  })
  .then(classes => {
    return (async () => {
      const newsList = []
      const files = []
      console.log('Loading IDs')
      for (const classStudent of classes) { // for each class
        console.log(` > ${classStudent.title} : ${classStudent.id}`)
      }
      console.log('Loading Exam Calendar')
      for (const classStudent of classes) { // for each class
        console.log(' > ' + classStudent.title)
        const examCalendar = await classStudent.getExamCalendar()
        console.log(examCalendar)
      }
      console.log('Loading Absence')
      for (const classStudent of classes) { // for each class
        console.log(' > ' + classStudent.title)
        const absencesClass = await classStudent.getAbsence()
        console.log(absencesClass)
      }
      console.log('Loading News')
      for (const classStudent of classes) { // for each class
        console.log(' > ' + classStudent.title)
        const newsClassList = await classStudent.getNews()
        newsClassList.forEach(newsClass => {
          newsList.push(newsClass)
        })
      }
      console.log('Loading Topics')
      for (const classStudent of classes) {
        console.log(await classStudent.getTopics())
      }

      console.log('Loading Files')
      for (const classStudent of classes) { // for each class
        console.log(' > ' + classStudent.title)
        const classFiles = await classStudent.getFiles() // this lists all topics
        classFiles.forEach(file => {
          files.push(file)
        })
      }
      console.log('Loading Full News')
      for (const news of newsList) {
        console.log(news.title)
        console.log(await news.getContent())
        console.log(await news.getTime())
        console.log()
      }
      console.log('Loading Grades')
      for (const classStudent of classes) {
        console.log(' > ' + classStudent.title)
        const grade = await classStudent.getGrades()
        console.log(grade)
      }
      console.log('Downloading Files')
      for (const file of files) { // for each file
        await file.download(BaseDestiny, (bytesDownloaded) => {
          const progress = Math.trunc(bytesDownloaded / 10) / 100 + 'kB'
          process.stdout.write('Progress: ' + progress + '\r')
        })
        console.log()
      }
    })()
  })
  .then(() => {
    return account.logoff() // logoff after finished downloads
  })
  .catch(err => {
    if (err.stack) console.log(err.stack)
    console.log(err)
  })
