const Sigaa = require ('..');
const https = require ('https');
const fs = require ('fs');
const uuid = require('uuid/v4');
const path = require ('path');
const querystring = require ('querystring');

const sigaa = new Sigaa ();


// put your crendecias
var userName = '';
var password = '';



//this creates folder downloads
let BaseDestiny = path.join (
  'downloads',
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
          for (let attachment of topic.attachments) { 
            if (attachment.type == 'file') {
              console.log(`> ${attachment.name}`)
              await downloadFile(studentClass, attachment);         
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
  

async function downloadFile(studentClass, attachment) {
  await new Promise((resolve, reject) => {

    fs.mkdir(path.join(BaseDestiny, studentClass.name), err => { // this creates path with class name
      if (err && err.code != 'EEXIST')
        throw 'up';

      let tmpFileDestiny = path.join(BaseDestiny, studentClass.name, uuid());
      let file = fs.createWriteStream(tmpFileDestiny);

      let link = new URL(attachment.form.action);
      
      //http options
      const options = {
        hostname: link.hostname,
        port: 443,
        path: link.pathname + link.search,
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:64.0) Gecko/20100101 Firefox/64.0',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': token
        },
      };
      
      // this converts post parameters to string
      let postOptionsString = querystring.stringify(attachment.form.postOptions);
      // this inserts post parameters length to  header http
      options.headers['Content-Length'] = Buffer.byteLength(postOptionsString);
     
      // makes request
      var request = https.request(options, (response) => {
        let filename = response.headers['content-disposition'].replace(/([\S\s]*?)filename=\"/gm, '').slice(0, -1);
        let filepath = path.join(BaseDestiny, studentClass.name, filename)
        response.pipe(file); //save to file
        
        file.on('finish', () => {
          file.close(resolve); // close() is async, call resolve after close completes.
          fs.rename(tmpFileDestiny, filepath, (err)=>{
            if (err) throw err;
          })
        });
      }).on('error', (err) => {
        fs.unlink(tmpFileDestiny); // Delete the file async.
        reject(false);
      });
      request.write(postOptionsString); //send post parameters
      request.end();
    });
  });
}