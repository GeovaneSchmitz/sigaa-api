const SigaaBase = require('./sigaa-base');
const SigaaTopic = require('./sigaa-topic')
const { JSDOM } = require('jsdom');
('use strict');

class SigaaClassStudent extends SigaaBase {
  constructor(classParam, options) {
    super(options.urlBase, options.cache);
    if (classParam.name != undefined &&
        classParam.id != undefined &&
        classParam.location != undefined &&
        classParam.schedule != undefined) {
        this._name = classParam.name
        this._id = classParam.id
        this._location = classParam.location
        this._schedule = classParam.schedule
    } else {
        throw "INVALID_CLASS_OPTIONS"
    }
    if (!options.token) {
        throw "ATTACHMENT_TOKEN_IS_NECESSARY"
    }
    this._token = options.token;

  }
  get id(){
    return this._id
  }
  get name(){
    return this._name
  }
  get location(){
    return this._location
  }
  get stringSchedule(){
    return this._schedule
  }
  _requestClassPage(classId, token) {
    return this._get('/sigaa/portais/discente/discente.jsf', token)
      .then(res => {
        return new Promise((resolve, reject) => {
          if (res.statusCode == 200) {
            let {document} = new JSDOM (res.body).window;
            let formEl = document.forms['form_acessarTurmaVirtual']
            let form = this._extractForm(formEl)

            form.postOptions['form_acessarTurmaVirtual:turmaVirtual'] =
              'form_acessarTurmaVirtual:turmaVirtual';
            form.postOptions['idTurma'] = classId;
            resolve(this._post(form.action, form.postOptions, res.token));
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
      })
      .then(res => {
        return new Promise((resolve, reject) => {
          if (res.statusCode == 200) {
            if (res.body.includes('Comportamento Inesperado!')) {
              reject({
                status: 'ERROR',
                errorCode: 'INVALID_CLASS_TOKEN',
              });
            } else {
              resolve(res);
            }
          } else {
            reject({
              status: 'ERROR',
              errorCode: res.statusCode,
            });
          }
        });
      });
  }
  getTopics() {
    return this._requestClassPage(this._id, this._token).then(res => {
      return new Promise((resolve, reject) => {
        
        let { document } = new JSDOM(res.body).window;
        let contentElement = document.getElementById('conteudo');
        let topicsElements;
        if (contentElement) {
          topicsElements = contentElement.querySelectorAll('.topico-aula');
        } else {
          reject(this._id);
        }
        let topics = [];
        for (let topicEl of topicsElements) {
          let topicNameElement = topicEl.querySelector('.titulo');
          let topicNameFull = topicNameElement.innerHTML
            .replace(/<[^>]+>| +(?= )|\t|\n/gm, '')
            .trim();

          let topicDates = topicNameFull.slice(
            topicNameFull.lastIndexOf('(') + 1,
            topicNameFull.lastIndexOf(')')
          );
          let topicStartDate = topicDates.slice(0, topicDates.indexOf(' '));
          let topicEndDate = topicDates.slice(
            topicDates.lastIndexOf(' ') + 1
          );
          let topicName = topicNameFull.slice(
            0,
            topicNameFull.lastIndexOf('(')
          );
          let topicContentElement = topicEl.querySelector('.conteudotopico');
          let topicContentText = decodeURI(
            this._removeTagsHtml(topicContentElement.innerHTML.replace(/\<div([\S\s]*?)div>/gm, ''))
          );

          let topicAttachments = [];

          if (topicContentElement.querySelector('span[id] > div.item')) {
            for (let AttachmentElement of topicContentElement.querySelectorAll(
              'span[id] > div.item'
            )) {
              let attachment = {
                type: '',
                title: '',
                description: '',
              };

              let iconElement = AttachmentElement.querySelector('img');
              if (iconElement.src.includes('questionario.png')) {
                attachment.type = 'quiz';
              } else if (iconElement.src.includes('video.png')) {
                attachment.type = 'video';
                attachment.src = AttachmentElement.querySelector('iframe').src;
              } else if (iconElement.src.includes('survey.png')) {
                attachment.type = 'survey';
              } else {
                attachment.type = 'file';
              }

              let descriptionElement = AttachmentElement.querySelector(
                'div.descricao-item'
              ).firstChild;

              attachment.description = decodeURI(
                this._removeTagsHtml(descriptionElement.innerHTML)
              );

              let titleElement = AttachmentElement.querySelector('span')
                .firstChild;
              attachment.title = titleElement.innerHTML.trim();

              attachment.form = this._extractJSFCLJS(
                titleElement.getAttribute('onclick'),
                res.body
              );
              topicAttachments.push(attachment);
            }
          }

      
          let topic = new SigaaTopic({
            name:topicName,
            contentText:topicContentText,
            attachments:topicAttachments,
            startDate:topicStartDate,
            endDate:topicEndDate,
          }, this._token)
          topics.push(topic)
        }
        resolve(topics);
      });
    });
  }
  getNewsIndex() {
    return this._requestClassPage(this._id, this._token)
      .then(res => {
        return new Promise((resolve, reject) => {
          let { document } = new JSDOM(res.body).window;

          let newsBtnEl = Array.from(
            document.querySelectorAll('div.itemMenu')
          ).find(el => {
            return el.textContent === 'Notícias';
          });

          let form = this._extractJSFCLJS(
            newsBtnEl.parentElement.getAttribute('onclick'),
            res.body
          );
          resolve(this._post(form.action, form.postOptions, this._token));
        });
      })
      .then(res => {

        return new Promise((resolve, reject) => {
          let { document } = new JSDOM(res.body).window;
          let table = document.querySelector(".listing");
          
          if(!table) resolve([])
          let news = []
          for (let row of table.querySelectorAll("tr[class]")) {
            let cell = row.children;
            news.push({
              name: this._removeTagsHtml(cell[0].innerHTML),
              date: this._removeTagsHtml(cell[1].innerHTML),
              newsId: this._extractJSFCLJS(
                cell[2].firstChild.getAttribute('onclick'),
                res.body
              )
            })
          }
          resolve(news)
        })

      })
  }
  getNews(newsId) {
    return this._post(newsId.action, newsId.postOptions, this._token)
      .then(res => {
        return new Promise((resolve, reject) => {
          let { document } = new JSDOM(res.body).window;
          let newsEl = document.querySelector("ul.form")
          if(!newsEl) reject({status:"ERROR", errorCode: "UNKNOWN"})
          let news = {}
          let els = newsEl.querySelectorAll("span")  
          news.name = this._removeTagsHtml(els[0].innerHTML);
          news.date = this._removeTagsHtml(els[1].innerHTML);
          news.content = this._removeTagsHtml(newsEl.querySelector("div").innerHTML);          
          resolve(news)
        })

      })
  }
  getGrades() {
    return this._requestClassPage(this._id, this._token)
      .then(res => {
        return new Promise((resolve, reject) => {
          let { document } = new JSDOM(res.body).window;

          let getGradesBtnEl = Array.from(
            document.querySelectorAll('div.itemMenu')
          ).find(el => {
            return el.textContent === 'Ver Notas';
          });

          let form = this._extractJSFCLJS(
            getGradesBtnEl.parentElement.getAttribute('onclick'),
            res.body
          );
          resolve(this._post(form.action, form.postOptions, this._token));
        });
      })
      .then(res => {
        return new Promise((resolve, reject) => {

          let getCellByPositionColSpan = (ths, position) => {
            var i = 0;
            for (let tr of ths) {
              i += tr.colSpan
              if (i >= position) {
                return tr;
              }
            }
            return false;
          }

          let getPositionByCellColSpan = (ths, cell) => {
            var i = 0;
            for (let tr of ths) {
              if (cell === tr) {
                return i;
              }
              i += tr.colSpan

            }
            return false;

          }

          let removeCellsWithName = [
            '',
            'Matrícula',
            'Nome',
            'Sit.',
            'Faltas',
          ];


          let { document } = new JSDOM(res.body).window;
          let theadTrs = document.querySelectorAll('thead tr');
          let valueCells = document.querySelector('tbody tr').children;

          let grades = [];
          let theadTrsThs = [];

          for (let theadTr of theadTrs) {
            theadTrsThs.push(theadTr.querySelectorAll("th"))
          }

          for (let i = 0; i < theadTrsThs[0].length; i++) {
            let gradeGroupName = this._removeTagsHtml(theadTrsThs[0][i].innerHTML);
            if (removeCellsWithName.indexOf(gradeGroupName) == -1) {
              let gradeGroup = {
                name: gradeGroupName,
              }
              let index = getPositionByCellColSpan(theadTrsThs[0], theadTrsThs[0][i])
              if (theadTrsThs[0][i].colSpan == 1) {
                gradeGroup.value = parseFloat(this._removeTagsHtml(valueCells[index].innerHTML).replace(/,/g, '.'));
              } else {
                gradeGroup.grades = []
                for (let j = index; j < index + theadTrsThs[0][i].colSpan; j++) {
                  
                  let gradeId = theadTrsThs[1][j].id.slice(5);

                  if(gradeId !== ""){
                    let gradeName = document.querySelector(`input#denAval_${gradeId}`).value
                    let gradeAbbreviation = document.querySelector(`input#abrevAval_${gradeId}`).value
                    let gradeWeight = document.querySelector(`input#pesoAval_${gradeId}`).value
                    gradeGroup.grades.push({
                      name: gradeName,
                      abbreviation:gradeAbbreviation,
                      weight:gradeWeight,
                      value:parseFloat(this._removeTagsHtml(valueCells[j].innerHTML).replace(/,/g, '.'))
                    })
                  }else{
                    let cellName = getCellByPositionColSpan(theadTrsThs[1], j + 1)
                    var gradeName = this._removeTagsHtml(cellName.innerHTML);
                    gradeGroup.average = parseFloat(this._removeTagsHtml(valueCells[j].innerHTML).replace(/,/g, '.'))
 
                  }
                  
                }
              }
              grades.push(gradeGroup)
            }
          }
          resolve(grades);
        });
      });
  }
}

module.exports = SigaaClassStudent;
