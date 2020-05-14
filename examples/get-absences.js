const Sigaa = require('..')

const sigaa = new Sigaa({
  url: 'https://sigaa.ifsc.edu.br'
})

// put your crendecias
const username = ''
const password = ''

const main = async () => {
  const account = await sigaa.login(username, password) // login
  if (account.userType !== 'STUDENT') throw new Error('USER_IS_NOT_A_STUDENT')
  const courses = await account.getCourses() // this return a array with all current courses
  console.log('Loading Absence')
  for (const course of courses) {
    // for each course
    console.log(' > ' + course.title)
    const absencesCourse = await course.getAbsence()
    console.log(absencesCourse)
  }
  account.logoff()
}
main().catch((err) => {
  if (err) console.log(err)
})
