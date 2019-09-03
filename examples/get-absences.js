const Sigaa = require('..')

const sigaa = new Sigaa({
  url: 'https://sigaa.ifsc.edu.br'
})

// put your crendecias
var username = ''
var password = ''

const main = async () => {
  const account = await sigaa.login(username, password) // login
  if (account.userType !== 'STUDENT') throw new Error('USER_IS_NOT_A_STUDENT')
  const classes = await account.getAllClasses() // this return a array with all current classes
  console.log('Loading Absence')
  for (const classStudent of classes) { // for each class
    console.log(' > ' + classStudent.title)
    const absencesClass = await classStudent.getAbsence()
    console.log(absencesClass)
  }
  account.logoff()
}
main().catch(err => {
  if (err) console.log(err)
})
