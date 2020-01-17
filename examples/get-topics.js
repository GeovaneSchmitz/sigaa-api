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
    return sigaaAccount.getClasses() // this return a array with all current classes
  })
  .then((classes) => {
    return (async () => {
      for (const classStudent of classes) {
        // for each class
        console.log(' > ' + classStudent.title)
        const topics = await classStudent.getTopics() // this lists all topics
        for (const topic of topics) {
          console.log(`\t> ${topic.title}`)
          if (topic.contentText) console.log(`\t${topic.contentText}`)
          const startDate = topic.startDate.toString()
          const endDate = topic.endDate.toString()
          console.log(`\tstartDate:${startDate}, endDate:${endDate}`)
          for (const attachment of topic.attachments) {
            if (attachment.title) console.log(`\t\ttitle: ${attachment.title}`)
            if (attachment.description)
              console.log(`\t\tdescription: ${attachment.description}`)
            if (attachment.getDescription)
              console.log(
                `\t\tdescription: ${await attachment.getDescription()}`
              )
            if (attachment.getHaveGrade)
              console.log(`\t\thaveGrade: ${await attachment.getHaveGrade()}`)
            if (attachment.src) console.log(`\t\tsrc: ${attachment.src}`)
            if (attachment.id) console.log(`\t\tid: ${attachment.id}`)
            if (attachment.start)
              console.log(`\t\tstartDate: ${attachment.startDate.toString()}`)
            if (attachment.end)
              console.log(`\t\tendDate: ${attachment.endDate.toString()}`)
          }
        }
      }
      process.exit()
    })()
  })
  .catch((err) => {
    console.log(err)
  })
