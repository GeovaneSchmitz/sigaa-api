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
    return sigaaAccount.getCourses() // this return a array with all current courses
  })
  .then((courses) => {
    for (const course of courses) {
      console.log(course.title)
      console.log(course.location)
      console.log(course.scheduleSIGAAnotation)
    }
  })
  .catch((err) => {
    console.log(err)
  })
