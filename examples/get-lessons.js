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
        // for each course
        console.log(' > ' + course.title)
        const lessons = await course.getLessons() // this lists all lessons
        for (const lessonn of lessons) {
          console.log(`\t> ${lessonn.title}`)
          if (lessonn.contentText) console.log(`\t$lessonon.contentText}`)
          const startDate = lessonn.startDate.toString()
          const endDate = lessonn.endDate.toString()
          console.log(`\tstartDate:${startDate}, endDate:${endDate}`)
          for (const attachment of lessonn.attachments) {
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
