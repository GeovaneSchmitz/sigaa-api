const Sigaa = require('..')

const sigaa = new Sigaa({
  urlBase: 'https://sigaa.ifsc.edu.br'
})

// put your crendecias
var username = ''
var password = ''

sigaa.login(username, password) // return SigaaAccount
  .then(sigaaAccount => {
    return sigaaAccount.getClasses() // this return a array with all current classes
  })
  .then(classes => {
    for (const classStudent of classes) {
      console.log(classStudent.name)
      console.log(classStudent.location)
      console.log(classStudent.stringSchedule)
    }
  })
  .catch(err => {
    console.log(err)
  })
