const Sigaa = require('./sigaa')
const { JSDOM } = require('jsdom')
;('use strict')

class SigaaAccount extends Sigaa {
  constructor (urlBase, cache) {
    super(urlBase, cache)
  }
  getClasses (token) {
    return this._get('/sigaa/portais/discente/discente.jsf', token).then(res => {
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
    return this._get('/sigaa/portais/discente/discente.jsf', token).then(res => {
      return new Promise((resolve, reject) => {
        if (res.statusCode == 200) {
          let form = this._extractForm(res, 'form_acessarTurmaVirtual')

          form.postOptions['form_acessarTurmaVirtual:turmaVirtual'] =
            'form_acessarTurmaVirtual:turmaVirtual'
          form.postOptions["idTurma"] = classId
          resolve(this._post(form.action, form.postOptions, res.token))
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
        let contentElement = document.getElementById('conteudo')
        let topicsElements;
        if(contentElement){
          topicsElements = contentElement.querySelectorAll(".topico-aula")
        }else{
          reject(classId)
        }
        let topics = []
        for(let topicEl of topicsElements){
          let topicTitleElement = topicEl.querySelector(".titulo")
          let topicTitleFull = topicTitleElement.innerHTML.replace(/<[^>]+>| +(?= )|\t|\n/gm, '').trim()
          
          let topicDates = topicTitleFull.slice(topicTitleFull.lastIndexOf("(")+1, topicTitleFull.lastIndexOf(")"))
          let topicStartDate = topicDates.slice(0,topicDates.indexOf(" "))
          let topicEndDate = topicDates.slice(topicDates.lastIndexOf(" ")+1)
          let topicTitle = topicTitleFull.slice(0, topicTitleFull.lastIndexOf("("))
          let topicContentElement = topicEl.querySelector(".conteudotopico")
          let topicContentText = decodeURI(this._removeTagsHtml(topicContentElement.innerHTML))

          let topicAttachments = []


          if(topicContentElement.querySelector("span[id] > div.item")){
            for(let AttachmentElement of topicContentElement.querySelectorAll("span[id] > div.item")){
              
              let attachment = {
                type:"",
                title:"",
                description:""
              }

              
              let iconElement = AttachmentElement.querySelector("img")
              if(iconElement.src.includes("questionario.png")){
                attachment.type = "quiz"
              }else if(iconElement.src.includes("video.png")){
                attachment.type = "video";
                attachment.src = AttachmentElement.querySelector("iframe").src;
              }else if(iconElement.src.includes("survey.png")){
                attachment.type = "survey"
              }else{
                attachment.type = "file"
              }

              let descriptionElement = AttachmentElement.querySelector("div.descricao-item").firstChild

              attachment.description = decodeURI(this._removeTagsHtml(descriptionElement.innerHTML))
              
              let titleElement = AttachmentElement.querySelector("span").firstChild
              attachment.title = titleElement.innerHTML.trim()

              attachment.form = this._extractJSFCLJS(titleElement.getAttribute("onclick"), res)
              topicAttachments.push(attachment)
            }
          }
          
          let topic = {};
          topic.title = topicTitle
          topic.contentText = topicContentText
          topic.attachments = topicAttachments

          topic.startDate = topicStartDate
          topic.endDate = topicEndDate
          topics.push(topic)
        }
        resolve(topics)
      })
    })
  }
  
}

module.exports = SigaaAccount
