const Sigaa = require ('..');
const fs = require ('fs');
const path = require ('path');

const sigaa = new Sigaa ();


// put your crendecias
var userName = 'geovane.s06';
var password = '33461334gG';



//this creates folder downloads
let BaseDestiny = path.join (
  '.',
  'downloads'
);

fs.mkdir(BaseDestiny, err => { 
  if (err && err.code != 'EEXIST') throw 'up'
})


sigaa.account
  .login (userName, password) // login
  .then (res => {
    /* res = {
      status:'LOGGED',
      userType:'STUDENT',
      token: random string
    }
    */
    if(res.userType === 'STUDENT'){
      token = res.token; // this stores access token
      return sigaa.classStudent.getClasses (res.token); // this return a array with all classes
    }else{
      throw 'user is not a student'
    }
  })
  .then (classes => {
    async function listClasses () {
      for (let studentClass of classes) { //for each class
        console.log(studentClass.name)
        var topics = await sigaa.classStudent.getTopics (
          studentClass.id,
          token
        ); //this lists all topics
        for (let topic of topics) { //for each topic
          let attachments = topic.attachments
          for (let attachment of attachments) { 
            if (attachment.type == 'file') {
              await attachment.downloadFile(BaseDestiny);         
            }
          }
        }
      }
    }
    listClasses () 
      .then (() => {
        sigaa.account
          .logoff (token) // logoff afeter finished downloads
          .catch (data => {
            console.log (data);
          });
      })
      .catch (data => {
        console.log (data);
      });
  })
  .catch (data => {
    console.log (data);
  });
  