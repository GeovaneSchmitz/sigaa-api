const { JSDOM } = require('jsdom')


const SigaaAccount = require('./sigaa-account')
const SigaaClassStudent = require('./sigaa-class-student')

'use strict'

class SigaaAccountStudent extends SigaaAccount {
  constructor (sigaaData) {
    super(sigaaData)
  }
  get token(){
    return this._data.token
  }
  getClasses() {
    return new Promise((resolve, reject) => {
      
      resolve()
    }).then(() => {
      return this._get(
        '/sigaa/portais/discente/discente.jsf',
        this._data.token)
    }).then(res => {
      return new Promise((resolve, reject) => {
        if (res.statusCode == 200) {
          let { document } = new JSDOM(res.body).window;
          let tbodyClasses = document
            .querySelector('div#turmas-portal.simple-panel')
            .querySelector("table[style='margin-top: 1%;']")
            .querySelector('tbody');
          let trsClasses = tbodyClasses.querySelectorAll(
            "tr[class=''], tr.odd"
          );
          let list = [];
          for (var i = 0; i < trsClasses.length; i++) {
            let tds = trsClasses[i].querySelectorAll('td');
            let name = tds[0].querySelector('a').innerHTML;
            let id = tds[0].querySelector("input[name='idTurma']").value;
            let location = tds[1].innerHTML;
            let schedule = tds[2].firstChild.innerHTML.replace(/\t|\n/g, '');
            
            list.push(new SigaaClassStudent({
              name,
              id,
              location,
              schedule,
            }, this._data));
          }
          resolve(list);
        } else if (res.statusCode == 302) {
          reject({
            status: 'ERROR',
            errorCode: 'INVALID_TOKEN',
          });
        } else {
          reject({
            status: 'ERROR',
            errorCode: res.statusCode,
          });
        }
      });
    });
  }
 
  
}

module.exports = SigaaAccountStudent
