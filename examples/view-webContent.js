const Sigaa = require('..')

const sigaa = new Sigaa({
  urlBase: 'https://sigaa.ifsc.edu.br'
})

// put your crendecias
var username = ''
var password = ''

sigaa.login(username, password) // return SigaaAccount
  .then(sigaaAccount => {
    return sigaaAccount.getAllClasses() // this return a array with all current classes
  })
  .then(classes => {
    return (async () => {
      for (const classStudent of classes) {
        console.log(' > ' + classStudent.title)
        const webContents = await classStudent.getWebContents() // this lists all topics
        for (const webContent of webContents) {
          console.log(`\t> ${webContent.title}`)
          const date = new Date(webContent.timestamp * 1000).toString()
          console.log(`\t${date}`)
          console.log(`\t\ttype: ${webContent.type}`)
          console.log(`\t\tid: ${webContent.id}`)
          console.log(`\t\ttimestamp: ${webContent.timestamp}`)
          console.log(`\t\tgetDescription: ${await webContent.getDescription()}`)
        }
      }
    })()
  })
  .catch(err => {
    console.log(err)
  })
