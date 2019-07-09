const Sigaa = require ('..');
const fs = require ('fs');
const path = require ('path');

const sigaa = new Sigaa ({
  urlBase: 'https://sigaa.ifsc.edu.br'
});


// put your crendecias
var username = '';
var password = '';



let BaseDestiny = path.join ('.','downloads');

//this creates BaseDestiny
fs.mkdir(BaseDestiny, err => { 
  if (err && err.code != 'EEXIST') throw 'up'
})

let account;

sigaa.login(username, password) // login
  .then (sigaaAccount => {
    account = sigaaAccount
    return account.getClasses (); // this return a array with all classes
  })
  .then (classes => {
    return (async () =>{
      let newsList = []
      let topics = []
      console.log("Loading IDs")
      for (let classStudent of classes) { //for each class
        console.log(` > ${classStudent.name} : ${classStudent.id}`)
      }
      console.log("Loading Absence")
      for (let classStudent of classes) { //for each class
        console.log(" > " + classStudent.name)
        let absencesClass = await classStudent.getAbsence()
        console.log(absencesClass)
      }
      console.log("Loading News")
      for (let classStudent of classes) { //for each class
        console.log(" > " + classStudent.name)
        let newsClassList = await classStudent.getNews()
        newsClassList.forEach(newsClass => {
          newsList.push(newsClass)
        });
      }
      console.log("Loading Topics")
      for (let classStudent of classes) { //for each class
        console.log(" > " + classStudent.name)
        let  classTopics = await classStudent.getTopics (); //this lists all topics
        classTopics.forEach(topic => {
          topics.push(topic)
        });
      }
      console.log("Loading Full News")
      for(let news of newsList){
        console.log(news.name)
        console.log(await news.getContent())
        console.log(await news.getTime())
        console.log()
      }
      console.log("Loading Grades")
      for (let classStudent of classes) {
        console.log(" > " + classStudent.name)
        let grade = await classStudent.getGrades ()
        console.log(grade)
      }
      console.log("Downloading Attachment")
      for (let topic of topics) { //for each topic
        let attachments = topic.attachments
        for (let attachment of attachments) { 
          if (attachment.type == 'file') {
            console.log()
            await attachment.downloadFile(BaseDestiny, ((bytesDownloaded) => {
              let progress = Math.trunc(bytesDownloaded /10)/100 + "kB"
              process.stdout.write('Progress: '+progress+'\r');
            }));         
          }
        }
      }
    })()
  })
.then (() => {
  return account.logoff() // logoff afeter finished downloads
})
.catch (data => {
  if(data.stack) console.log (data.stack);
  console.log(data)
  });