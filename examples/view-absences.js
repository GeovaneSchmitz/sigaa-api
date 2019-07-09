const Sigaa = require ('..');
const fs = require ('fs');
const path = require ('path');

const sigaa = new Sigaa ({
  urlBase: 'https://sigaa.ifsc.edu.br'
});


// put your crendecias
var username = '';
var password = '';


let account;

sigaa.login(username, password) // login
  .then (sigaaAccount => {
    account = sigaaAccount
    return account.getClasses (); // this return a array with all classes
  })
  .then (classes => {
    return (async () =>{
      console.log("Loading Absence")
      for (let classStudent of classes) { //for each class
        console.log(" > " + classStudent.name)
        let absencesClass = await classStudent.getAbsence()
        console.log(absencesClass)
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