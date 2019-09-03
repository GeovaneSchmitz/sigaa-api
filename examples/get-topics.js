const Sigaa = require('..')

const sigaa = new Sigaa({
  url: 'https://sigaa.ifsc.edu.br'
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
      for (const classStudent of classes) { // for each class
        console.log(' > ' + classStudent.title)
        const topics = await classStudent.getTopics() // this lists all topics
        for (const topic of topics) {
          console.log(`\t> ${topic.title}`)
          if (topic.contentText) console.log(`\t${topic.contentText}`)
          const startDate = new Date(topic.startTimestamp * 1000).toString()
          const endDate = new Date(topic.endTimestamp * 1000).toString()
          console.log(`\t${startDate} ${endDate}`)
          for (const attachment of topic.attachments) {
            if (attachment.description) console.log(`\t\tdescription: ${attachment.description}`)
            if (attachment.getDescription) console.log(`\t\tdescription: ${await attachment.getDescription()}`)
            if (attachment.getHaveGrade) console.log(`\t\thaveGrade: ${await attachment.getHaveGrade()}`)
            if (attachment.src) console.log(`\t\tsrc: ${attachment.src}`)
            if (attachment.id) console.log(`\t\tid: ${attachment.id}`)
            if (attachment.startTimestamp) console.log(`\t\tstartTimestamp: ${attachment.startTimestamp}`)
            if (attachment.endTimestamp) console.log(`\t\tendTimestamp: ${attachment.endTimestamp}`)
          }
        }
      }
      process.exit()
    })()
  })
  .catch(err => {
    console.log(err)
  })
