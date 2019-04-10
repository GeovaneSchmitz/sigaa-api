const Sigaa = require ('..');
const https = require ('https');
const fs = require ('fs');
const path = require ('path');
const querystring = require ('querystring');

const sigaa = new Sigaa ();


// put your crendecias
var userName = '';
var password = '';

let token;

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
    let studentClass = classes[1]
    return sigaa.classStudent.getTopics(studentClass.id, token)
  })
  .then ((data) => {
    return sigaa.account.logoff (token) // logoff afeter finished downloads
 
  })
  .catch (data => {
    console.log (data);
  });
  
