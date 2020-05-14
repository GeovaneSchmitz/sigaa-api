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
    return (async () => {
      for (const course of courses) {
        console.log(' > ' + course.title)
        const webContents = await course.getWebContents() // this lists all lessons
        for (const webContent of webContents) {
          console.log(`\t> ${webContent.title}`)
          const date = webContent.date.toString()
          console.log(`\t\ttype: ${webContent.type}`)
          console.log(`\t\tdate: ${date}`)
          console.log(`\t\tid: ${webContent.id}`)
          console.log(
            `\t\tgetDescription: ${await webContent.getDescription()}`
          )
        }
      }
    })()
  })
  .catch((err) => {
    console.log(err)
  })
