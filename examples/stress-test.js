const Sigaa = require('..')
const fs = require('fs')
const path = require('path')

const sigaa = new Sigaa({
  url: 'https://sigaa.ifsc.edu.br'
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
    return account.getClasses(true) // this return a array with all classes
  })
  .then(classes => {
    return (async () => {
      console.log('Loading IDs')
      for (const classStudent of classes) { // for each class
        console.log(` > ${classStudent.title} : ${classStudent.id}`)

        console.log('Loading Exam Calendar')
        const examCalendar = await classStudent.getExamCalendar()
        console.log(examCalendar)

        console.log('Loading Absence')
        const absencesClass = await classStudent.getAbsence()
        console.log(absencesClass)

        console.log('Loading News')
        const newsClassList = await classStudent.getNews()
        console.log('Loading Full News')
        for (const news of newsClassList) {
          console.log(news.title)
          console.log(await news.getContent())
          console.log((await news.getDate()).toString())
          console.log()
        }
        console.log('Loading Topics')
        const topics = await classStudent.getTopics()
        for (const topic of topics) {
          console.log(`\t> ${topic.title}`)
          if (topic.contentText) console.log(`\t${topic.contentText}`)
          const startDate = topic.startDate.toString()
          const endDate = topic.endDate.toString()
          console.log(`\tstart:${startDate} end:${endDate}`)
          for (const attachment of topic.attachments) {
            if (attachment.description) console.log(`\t\tdescription: ${attachment.description}`)
            if (attachment.getDescription) console.log(`\t\tdescription: ${await attachment.getDescription()}`)
            if (attachment.getHaveGrade) console.log(`\t\thaveGrade: ${await attachment.getHaveGrade()}`)
            if (attachment.src) console.log(`\t\tsrc: ${attachment.src}`)
            if (attachment.id) console.log(`\t\tid: ${attachment.id}`)
            if (attachment.startDate) console.log(`\t\tstartDate: ${attachment.startDate.toString()}`)
            if (attachment.endDate) console.log(`\t\tendDate: ${attachment.endDate.toString()}`)
          }
        }
        console.log('Loading Files')
        const classFiles = await classStudent.getFiles() // this lists all topics
        console.log('Downloading Files')
        for (const file of classFiles) { // for each file
          await file.download(BaseDestiny, (bytesDownloaded) => {
            const progress = Math.trunc(bytesDownloaded / 10) / 100 + 'kB'
            process.stdout.write('Progress: ' + progress + '\r')
          })
          console.log()
        }

        console.log('Loading Grades')
        const grade = await classStudent.getGrades()
        console.log(grade)
      }
    })()
  })
  .then(() => {
    return account.logoff()
  })
  .catch(err => {
    console.log(err.message)
    console.log(err.stack)
  })
