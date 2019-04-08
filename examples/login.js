const Sigaa = require ('..');

const sigaa = new Sigaa ();

// put your crendecias
var userName = '';
var password = '';

sigaa.account
  .login (userName, password) // login
  .then (res => {
    /* res = {
      status:'LOGGED',
      userType:'STUDENT',
      token: random string
    }
    */
    return sigaa.classStudent.getClasses (res.token); // this return a array with all classes
  })
  .then(classes =>{
    console.log(classes)
  })
  .catch (data => {
    console.log (data);
  });
