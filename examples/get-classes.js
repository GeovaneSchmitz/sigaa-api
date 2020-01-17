const Sigaa = require('..')

const sigaa = new Sigaa({
  url: 'https://sigaa.ifsc.edu.br'
})

// put your crendecias
const username = ''
const password = ''

sigaa
  .login(username, password) // return SigaaAccount
  .then((sigaaAccount) => {
    return sigaaAccount.getClasses() // this return a array with all current classes
  })
  .then((classes) => {
    for (const classStudent of classes) {
      console.log(classStudent.title)
      console.log(classStudent.location)
      console.log(classStudent.scheduleSIGAAnotation)
    }
  })
  .catch((err) => {
    console.log(err)
  })
