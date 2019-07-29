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
    return (async () => {
      for (const classStudent of classes) { // for each class
        console.log(' > ' + classStudent.name)
        const topics = await classStudent.getTopics() // this lists all topics
        for (const topic of topics) {
          console.log(`\t> ${topic.name}`)
          if (topic.contentText) console.log(`\t${topic.contentText}`)
          const startDate = new Date(topic.startTimestamp).toString()
          const endDate = new Date(topic.endTimestamp).toString()
          console.log(`\t${startDate} ${endDate}`)
          for (const attachment of topic.attachments) {
            console.log(`\t\ttitle: ${attachment.title}`)
            console.log(`\t\ttype: ${attachment.type}`)
            if (attachment.description) console.log(`\t\tdescription: ${attachment.description}`)
            if (attachment.src) console.log(`\t\tsrc: ${attachment.src}`)
            if (attachment.id) console.log(`\t\tid: ${attachment.id}`)
          }
        }
      }
      process.exit()
    })()
  })
  .catch(err => {
    console.log(err)
  })
