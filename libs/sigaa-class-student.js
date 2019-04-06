const SigaaRequest = require('./sigaa-request')
const { JSDOM } = require('jsdom')
;('use strict')

class SigaaAccount extends SigaaRequest {
  constructor (cache) {
    super(cache)
  }
  getClasses (token) {
    return this.get('/sigaa/portais/discente/discente.jsf', token).then(res => {
      return new Promise((resolve, reject) => {
        if (res.statusCode == 200) {
          let { document } = new JSDOM(res.body).window
          let tbodyClasses = document
            .querySelector('div#turmas-portal.simple-panel')
            .querySelector("table[style='margin-top: 1%;']")
            .querySelector('tbody')
          let trsClasses = tbodyClasses.querySelectorAll("tr[class=''], tr.odd")
          let list = []
          for (var i = 0; i < trsClasses.length; i++) {
            let tds = trsClasses[i].querySelectorAll('td')
            let name = tds[0].querySelector('a').innerHTML
            let id = tds[0].querySelector("input[name='idTurma']").value
            let location = tds[1].innerHTML
            let schedule = tds[2].firstChild.innerHTML.replace(/\t|\n/g, '')
            list.push({
              name,
              id,
              location,
              schedule
            })
          }
          resolve(list)
        } else if (res.statusCode == 302) {
          reject({
            status: 'ERROR',
            errorCode: 'INVALID_TOKEN'
          })
        } else {
          reject({
            status: 'ERROR',
            errorCode: res.statusCode
          })
        }
      })
    })
  }
  getTopics (classId, token) {
    return this.get('/sigaa/portais/discente/discente.jsf', token).then(res => {
      return new Promise((resolve, reject) => {
        if (res.statusCode == 200) {
          let form = this.extractForm(res, 'form_acessarTurmaVirtual')

          form.postOptions['form_acessarTurmaVirtual:turmaVirtual'] =
            'form_acessarTurmaVirtual:turmaVirtual'
          form.postOptions["idTurma"] = classId
          resolve(this.post(form.action, form.postOptions, res.token))
        } else if (res.statusCode == 302) {
          reject({
            status: 'ERROR',
            errorCode: 'INVALID_TOKEN'
          })
        } else {
          reject({
            status: 'ERROR',
            errorCode: res.statusCode
          })
        }
      })
    })
    .then(res =>{
      return new Promise((resolve, reject) => {
        let { document } = new JSDOM(res.body).window
        let contentEl = document.getElementById('conteudo')
        let topicsEls;
        if(contentEl){
          topicsEls = contentEl.querySelectorAll(".topico-aula")
        }else{
          reject(classId)
        }
        let topics = []
        for(let topicEl of topicsEls){
          let topicTitleEl = topicEl.querySelector(".titulo")
          let topicTitleFull = topicTitleEl.innerHTML.replace(/<[^>]+>| +(?= )|\t|\n/gm, '').trim()
          
          let topicDates = topicTitleFull.slice(topicTitleFull.lastIndexOf("(")+1, topicTitleFull.lastIndexOf(")"))
          let topicStartDate = topicDates.slice(0,topicDates.indexOf(" "))
          let topicEndDate = topicDates.slice(topicDates.lastIndexOf(" ")+1)
          let topicTitle = topicTitleFull.slice(0, topicTitleFull.lastIndexOf("("))
          let topicContentEl = topicEl.querySelector(".conteudotopico")
          let topicContent = decodeURI(topicContentEl.innerHTML.replace(/<script([\S\s]*?)>([\S\s]*?)<\/script>|&nbsp;|<a([\S\s]*?)>([\S\s]*?)<\/a>|<[^>]+>| +(?= )|\t/gm, '').trim())

          let topicFiles = []


          if(topicContentEl.querySelector("a")){
            for(let fileEl of topicContentEl.querySelectorAll("a")){
              let file = {}
              file.fileName = fileEl.innerHTML.replace(/<script([\S\s]*?)>([\S\s]*?)<\/script>|&nbsp;|<a([\S\s]*?)>([\S\s]*?)<\/a>|<[^>]+>| +(?= )|\t|\n/gm, '').trim()
              file.id = fileEl.getAttribute("onclick").replace(/if([\S\s]*?)id,|'([\S\s]*?)false/gm,'')
              topicFiles.push(file)
            }
          }
          
          let topic = {};
          topic.title = topicTitle
          topic.content = topicContent
          topic.files = topicFiles

          topic.startDate = topicStartDate
          topic.endDate = topicEndDate
          topics.push(topic)
        }
        resolve(topics)
      })
    })
  }
  getFile (fileId, classId, token, force) {
    return this.get('/sigaa/portais/discente/discente.jsf', token,{noCache:force}).then(res => {
      return new Promise((resolve, reject) => {
        if (res.statusCode == 200) {
          let form = this.extractForm(res, 'form_acessarTurmaVirtual')
          form.postOptions['form_acessarTurmaVirtual:turmaVirtual'] =
            'form_acessarTurmaVirtual:turmaVirtual'
          form.postOptions["idTurma"] = classId
          resolve(this.post(form.action, form.postOptions, res.token, {noCache:force}))
        } else if (res.statusCode == 302) {
          reject({
            status: 'ERROR',
            errorCode: 'INVALID_TOKEN'
          })
        } else {
          reject({
            status: 'ERROR',
            errorCode: res.statusCode
          })
        }
    })
  })
  .then(res =>{
    return new Promise((resolve, reject) => {
      if(res.statusCode == 200){
        try{
          var form = this.extractForm(res, 'formAva')
        }catch(e){
          reject({
            status: 'ERROR',
            errorCode: 'INVALID_TOKEN'
          })
        }
        form.postOptions["formAva:j_id_jsp_1224201599_259:1:listaMateriais:0:idInserirMaterialArquivo"]="formAva:j_id_jsp_1224201599_259:1:listaMateriais:0:idInserirMaterialArquivo"
        form.postOptions["id"] = fileId
        resolve({
          
          postOptions
        }
        )
      }else{
        reject({
          status: 'ERROR',
          errorCode: res.statusCode
        })
      }
      })
    });
  
  

  }
}

module.exports = SigaaAccount
