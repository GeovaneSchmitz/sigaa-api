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
    return account.getClasses() // this return a array with all current classes
  })
  .then(classes => {
    return (async () => {
      const newsList = []
      const topics = []
      console.log('Loading IDs')
      for (const classStudent of classes) { // for each class
        console.log(` > ${classStudent.name} : ${classStudent.id}`)
      }
      console.log('Loading Absence')
      for (const classStudent of classes) { // for each class
        console.log(' > ' + classStudent.name)
        const absencesClass = await classStudent.getAbsence()
        console.log(absencesClass)
      }
      console.log('Loading News')
      for (const classStudent of classes) { // for each class
        console.log(' > ' + classStudent.name)
        const newsClassList = await classStudent.getNews()
        newsClassList.forEach(newsClass => {
          newsList.push(newsClass)
        })
      }
      console.log('Loading Topics')
      for (const classStudent of classes) { // for each class
        console.log(' > ' + classStudent.name)
        const classTopics = await classStudent.getTopics() // this lists all topics
        classTopics.forEach(topic => {
          topics.push(topic)
        })
      }
      console.log('Loading Full News')
      for (const news of newsList) {
        console.log(news.name)
        console.log(await news.getContent())
        console.log(await news.getTime())
        console.log()
      }
      console.log('Loading Grades')
      for (const classStudent of classes) {
        console.log(' > ' + classStudent.name)
        const grade = await classStudent.getGrades()
        console.log(grade)
      }
      console.log('Downloading Attachments')
      for (const topic of topics) { // for each topic
        const attachments = topic.attachments
        for (const attachment of attachments) {
          if (attachment.type === 'file') {
            console.log()
            await attachment.downloadFile(BaseDestiny, (bytesDownloaded) => {
              const progress = Math.trunc(bytesDownloaded / 10) / 100 + 'kB'
              process.stdout.write('Progress: ' + progress + '\r')
            })
          }
        }
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
