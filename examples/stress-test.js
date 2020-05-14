const Sigaa = require('..')
const fs = require('fs')
const path = require('path')

const sigaa = new Sigaa({
  url: 'https://sigaa.ifsc.edu.br'
})

// put your crendecias
const username = ''
const password = ''

const BaseDestiny = path.join('.', 'downloads')

// this creates BaseDestiny
fs.mkdir(BaseDestiny, (err) => {
  if (err && err.code !== 'EEXIST') throw new Error('up')
})

let account

sigaa
  .login(username, password) // login
  .then((sigaaAccount) => {
    account = sigaaAccount
    return account.getCourses(true) // this return a array with all courses
  })
  .then((courses) => {
    return (async () => {
      for (const course of courses) {
        // for each course
        console.log('Loading IDs')
        console.log(` > ${course.title} : ${course.id}`)

        console.log('Loading Exam Calendar')
        const examCalendar = await course.getExamCalendar()
        console.log(examCalendar)

        console.log('Loading Absence')
        const absencesCourse = await course.getAbsence()
        console.log(absencesCourse)

        console.log('Loading News')
        const newsCourseList = await course.getNews()
        console.log('Loading Full News')
        for (const news of newsCourseList) {
          console.log(news.title)
          console.log(await news.getContent())
          console.log((await news.getDate()).toString())
          console.log()
        }
        console.log('Loading Lessons')
        const lessons = await course.getLessons()
        for (const lesson of lessons) {
          console.log(`\t> ${lesson.title}`)
          if (lesson.contentText) console.log(`\t${lesson.contentText}`)
          const startDate = lesson.startDate.toString()
          const endDate = lesson.endDate.toString()
          console.log(`\tstart:${startDate} end:${endDate}`)
          for (const attachment of lesson.attachments) {
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
            if (attachment.startDate)
              console.log(`\t\tstartDate: ${attachment.startDate.toString()}`)
            if (attachment.endDate)
              console.log(`\t\tendDate: ${attachment.endDate.toString()}`)
          }
        }
        console.log('Loading Files')
        const courseFiles = await course.getFiles() // this lists all lessons
        console.log('Downloading Files')
        for (const file of courseFiles) {
          // for each file
          await file.download(BaseDestiny, (bytesDownloaded) => {
            const progress = Math.trunc(bytesDownloaded / 10) / 100 + 'kB'
            process.stdout.write('Progress: ' + progress + '\r')
          })
          console.log()
        }

        console.log('Loading Grades')
        const grade = await course.getGrades()
        console.log(grade)
      }
    })()
  })
  .then(() => {
    return account.logoff()
  })
  .catch((err) => {
    console.log(err.message)
    console.log(err.stack)
  })
