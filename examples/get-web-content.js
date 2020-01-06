const Sigaa = require('..')

const sigaa = new Sigaa({
  url: 'https://sigaa.ifsc.edu.br'
})

// put your crendecias
const username = ''
const password = ''

sigaa.login(username, password) // return SigaaAccount
  .then(sigaaAccount => {
    return sigaaAccount.getClasses() // this return a array with all current classes
  })
  .then(classes => {
    return (async () => {
      for (const classStudent of classes) {
        console.log(' > ' + classStudent.title)
        const webContents = await classStudent.getWebContents() // this lists all topics
        for (const webContent of webContents) {
          console.log(`\t> ${webContent.title}`)
          const date = webContent.date.toString()
          console.log(`\t\ttype: ${webContent.type}`)
          console.log(`\t\tdate: ${date}`)
          console.log(`\t\tid: ${webContent.id}`)
          console.log(`\t\tgetDescription: ${await webContent.getDescription()}`)
        }
      }
    })()
  })
  .catch(err => {
    console.log(err)
  })
