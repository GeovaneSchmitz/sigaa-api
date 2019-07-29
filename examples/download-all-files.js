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
      for (const classStudent of classes) { // for each class
        const pathPeriod = path.join(BaseDestiny, classStudent.period)
        const pathClass = path.join(pathPeriod, classStudent.name)
        console.log(classStudent.name)
        fs.mkdir(pathPeriod, err => {
          if (err && err.code !== 'EEXIST') throw new Error('up')
          fs.mkdir(pathClass, err => {
            if (err && err.code !== 'EEXIST') throw new Error('up')
          })
        })
        var topics = await classStudent.getTopics() // this lists all topics
        for (const topic of topics) { // for each topic
          const attachments = topic.attachments
          for (const attachment of attachments) {
            if (attachment.type === 'file' && true) {
              console.log(attachment.title)
              await attachment.downloadFile(pathClass, (bytesDownloaded) => {
                const progress = Math.trunc(bytesDownloaded / 10) / 100 + 'kB'
                process.stdout.write('Progress: ' + progress + '\r')
              }).catch(err => {
                console.error(err)
              })
              console.log()
            }
          }
        }
      }
    })()
  })
  .then(() => {
    return account.logoff() // logoff after finished downloads
  })
  .catch(data => {
    console.log(data)
  })
