const Sigaa = require('..')

const sigaa = new Sigaa({
  url: 'https://sigaa.ifsc.edu.br'
})

// put your crendecias
const username = ''
const password = ''

let account

sigaa
  .login(username, password) // login
  .then((sigaaAccount) => {
    account = sigaaAccount
    return account.getCourses() // this return a array with all current courses
  })
  .then((courses) => {
    return (async () => {
      for (const course of courses) {
        console.log(course.title)
        const grade = await course.getGrades()
        console.log(grade)
      }
    })()
  })
  .then(() => {
    return account.logoff() // logoff after finished
  })
  .catch((data) => {
    console.log(data)
  })
