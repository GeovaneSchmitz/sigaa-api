const Sigaa = require ('..');
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
    if (res.userType === 'STUDENT') {
      token = res.token; // this stores access token
      return sigaa.classStudent.getClasses (res.token); // this return a array with all classes
    } else {
      throw 'user is not a student';
    }
  })
  .then (classes => {
    async function viewNews () {
      for (let studentClass of classes) {
        let news = await sigaa.classStudent
          .getNewsIndex (studentClass.id, token)
          .catch (data => {
            console.log (data);
          });
        console.log(studentClass.name)
        for(let a of news){
        let newa = await sigaa.classStudent.getNews(a.newsId, token)
        console.log(newa.name)
        console.log(newa.date)
        console.log(newa.content)  
        }
      }
    }
    return viewNews()
  })
  .then (data => {
    console.log (data);

    return sigaa.account.logoff (token); // logoff afeter finished downloads
  })
  .catch (data => {
    console.log (data);
  });
