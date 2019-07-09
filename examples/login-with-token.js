const Sigaa = require ('..');
const fs = require ('fs');
const path = require ('path');

const sigaa = new Sigaa ({
  urlBase: 'https://sigaa.ifsc.edu.br'
});


// put your token (cookie)
var token = "JSESSIONID=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.srvXinstX";


sigaa.loginWithToken(token) // login
  .then (sigaaAccount => {
    return sigaaAccount.getClasses(); // this return a array with all classes
  })
  .then(classes =>{
    for(let classStudent of classes){
      console.log(classStudent.name)
      console.log(classStudent.location)
      console.log(classStudent.stringSchedule)
      console.log()
    }
  })
  .catch (err => {
    console.log (err);
  });