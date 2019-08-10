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
      for (const classStudent of classes) { // for each class
        console.log(classStudent.title)
        var files = await classStudent.getFiles() // this lists all topics
        if (files.length !== 0) {
          const pathPeriod = path.join(BaseDestiny, classStudent.period)
          const pathClass = path.join(pathPeriod, classStudent.title)
          fs.mkdir(pathPeriod, err => {
            if (err && err.code !== 'EEXIST') throw new Error('up')
            fs.mkdir(pathClass, err => {
              if (err && err.code !== 'EEXIST') {
                throw new Error('up')
              }
            })
          })
          for (const file of files) { // for each topic
            console.log(file.title)
            await file.download(pathClass, (bytesDownloaded) => {
              const progress = Math.trunc(bytesDownloaded / 10) / 100 + 'kB'
              process.stdout.write('Progress: ' + progress + '\r')
            }).catch(err => {
              console.error(err)
            })
            console.log()
          }
        }
      }
    })()
  })
  .then(() => {
    return account.logoff() // logoff after finished downloads
  })
  .catch(err => {
    console.log(err)
  })
