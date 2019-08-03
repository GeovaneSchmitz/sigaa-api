const Sigaa = require('..')

const sigaa = new Sigaa({
  urlBase: 'https://sigaa.ifsc.edu.br'
})

// put your crendecias
var username = ''
var password = ''

let account

sigaa.login(username, password) // login
  .then(sigaaAccount => {
    account = sigaaAccount
    return account.getClasses() // this return a array with all current classes
  })
  .then(classes => {
    return (async () => {
      console.log('Loading Absence')
      for (const classStudent of classes) { // for each class
        console.log(' > ' + classStudent.title)
        const absencesClass = await classStudent.getAbsence()
        console.log(absencesClass)
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
