const Sigaa = require ('..');
const sigaa = new Sigaa ();

// put your crendecias
var username = '';
var password = '';

let account;

sigaa.login (username, password) // login
  .then (sigaaAccount => {
    account = sigaaAccount
    return account.getClasses (); // this return a array with all classes
  })
  .then (classes => {
    return (async() => {
      for (let classStudent of classes) {
        console.log(classStudent)
        let grade = await classStudent.getGrades ()
        console.log(grade)
      }
    })()
  })
  .then (() => {
    return account.logoff(); // logoff afeter finished
  })
  .catch (data => {
    console.log (data);
  });
