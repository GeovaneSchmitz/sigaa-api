const Sigaa = require('..')

const sigaa = new Sigaa({
  url: 'https://sigaa.ifsc.edu.br'
})

// put your crendecias
const username = ''
const password = ''

let account

sigaa.login(username, password) // login
  .then(sigaaAccount => {
    account = sigaaAccount
    return account.getClasses() // this return a array with all current classes
  })
  .then(classes => {
    return (async () => {
      for (const classStudent of classes) {
        console.log(classStudent.title)
        const newsList = await classStudent.getNews()
        for (const news of newsList) {
          console.log('----------------')
          console.log(news.title)
          console.log(await news.getContent())
          console.log((await news.getDate()).toString())
          console.log('----------------')
        }
      }
    })()
  })
  .then(() => {
    return account.logoff() // logoff after finished
  })
  .catch(err => {
    console.log(err)
  })
