const Sigaa = require ('..');


const sigaa = new Sigaa ({
  urlBase: 'https://sigaa.ifsc.edu.br'
});

// put your crendecias
var username = '';
var password = '';

let account;

sigaa.login (username, password) // login
  .then (sigaaAccount => {
    let account = sigaaAccount;
    return account.getClasses (); // this return a array with all classes

  })
  .then (classes => {
    return (async () => {
      for (let classStudent of classes) {
        console.log(classStudent.name)
        let newsIndexList = await classStudent.getNewsIndex()
        for(let newsIndex of newsIndexList){
          let news = await classStudent.getNews(newsIndex.newsId)
          console.log(news)
        }
      }
    })();
  })
  .then (() => {

    return account.logoff (); // logoff afeter finished 
  })
  .catch (err => {
    console.log (err);
  });
