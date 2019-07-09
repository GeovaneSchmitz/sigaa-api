const SigaaBase = require('./sigaa-base');
const SigaaTopic = require('./sigaa-topic')
const SigaaNews = require('./sigaa-news')
const { JSDOM } = require('jsdom');
('use strict');

class SigaaClassStudent extends SigaaBase {
  constructor(classParam, sigaaData) {
    super(sigaaData);
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
    this._topics = []
    this._news = []
  }
  get name() {
    return this._name
  }
  get id(){
    return this._id
  }
  get location() {
    return this._location
  }
  get stringSchedule() {
    return this._schedule
  }
  _requestClassPage() {
    return this._get('/sigaa/portais/discente/discente.jsf', this._data.token)
      .then(res => {
        return new Promise((resolve, reject) => {
          if (res.statusCode == 200) {
            let { document } = new JSDOM(res.body).window;
            let formEl = document.forms['form_acessarTurmaVirtual']
            let form = this._extractForm(formEl)

            form.postOptions['form_acessarTurmaVirtual:turmaVirtual'] =
              'form_acessarTurmaVirtual:turmaVirtual';
            form.postOptions['idTurma'] = this._id;
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
    return this._requestClassPage()
      .then(res => new Promise((resolve, reject) => {
        let topicsElements = this._topicGetElements(res);
        let usedTopicsIndex = []
        for (let topicEl of topicsElements) {
          let topic = this._topicExtractor(topicEl, res);
          let topicClassIndex = this._topics.findIndex((topicClass) => {
            return topicClass.name == topic.name &&
              topicClass.startDate == topic.startDate &&
              topicClass.endDate == topic.endDate &&
              topicClass.contentText == topic.contentText
          })
          if (topicClassIndex > -1) {
            usedTopicsIndex.push(topicClassIndex)
            this._topics[topicClassIndex].update(topic)
          } else {
            this._topics.push(
              new SigaaTopic(topic, this.getTopics.bind(this),
                this._data));
                usedTopicsIndex.push(this._topics.length - 1 )

          }
        }
        this._topics = this._topics.filter((topic, index) => {
          if (usedTopicsIndex.indexOf(index) > -1) {
            return true
          } else {
            topic.finish()
            return false
          }
        })

        resolve(this._topics);
      }));
  }
  _topicGetElements(res) {
    let { document } = new JSDOM(res.body).window;
    let contentElement = document.getElementById('conteudo');
    let topicsElements;
    if (contentElement) {
      topicsElements = contentElement.querySelectorAll('.topico-aula');
    }
    else {
      topicsElements = []
    }
    return topicsElements;
  }

  _topicExtractor(topicEl, res) {
    let topicNameElement = topicEl.querySelector('.titulo');
    let topicNameFull = topicNameElement.innerHTML
      .replace(/<[^>]+>| +(?= )|\t|\n/gm, '')
      .trim();
    let topicDates = topicNameFull.slice(topicNameFull.lastIndexOf('(') + 1, topicNameFull.lastIndexOf(')'));
    let topicStartDate = topicDates.slice(0, topicDates.indexOf(' '));
    let topicEndDate = topicDates.slice(topicDates.lastIndexOf(' ') + 1);
    let topicName = topicNameFull.slice(0, topicNameFull.lastIndexOf('('));
    let topicContentElement = topicEl.querySelector('.conteudotopico');
    let topicContentText = decodeURI(this._removeTagsHtml(topicContentElement.innerHTML.replace(/\<div([\S\s]*?)div>/gm, '')));
    let topicAttachments = [];
    if (topicContentElement.querySelector('span[id] > div.item')) {
      for (let AttachmentElement of topicContentElement.querySelectorAll('span[id] > div.item')) {
        let attachment = {
          type: '',
          title: '',
          description: '',
        };
        let iconElement = AttachmentElement.querySelector('img');
        if (iconElement.src.includes('questionario.png')) {
          attachment.type = 'quiz';
        }
        else if (iconElement.src.includes('video.png')) {
          attachment.type = 'video';
          attachment.src = AttachmentElement.querySelector('iframe').src;
        }
        else if (iconElement.src.includes('survey.png')) {
          attachment.type = 'survey';
        }
        else {
          attachment.type = 'file';
        }
        let descriptionElement = AttachmentElement.querySelector('div.descricao-item').firstChild;
        attachment.description = decodeURI(this._removeTagsHtml(descriptionElement.innerHTML));
        let titleElement = AttachmentElement.querySelector('span')
          .firstChild;
        attachment.title = titleElement.innerHTML.trim();
        attachment.form = this._extractJSFCLJS(titleElement.getAttribute('onclick'), res.body);

        topicAttachments.push(attachment);
      }
    }
    let topic = {
      name: topicName,
      contentText: topicContentText,
      attachments: topicAttachments,
      startDate: topicStartDate,
      endDate: topicEndDate,
    }
    return topic;
  }

  getNews() {
    return this._clickLeftSidebarButton("Notícias")
      .then(res => {
        return new Promise((resolve, reject) => {
          let { document } = new JSDOM(res.body).window;
          
          let table = document.querySelector(".listing");

          if (!table) resolve([])
          let rows = table.querySelectorAll("tr[class]")
          if (this._news.length !== 0) {
            let usedNewsIndex = []

            for (let row of rows) {
              let cell = row.children;
              let name = this._removeTagsHtml(cell[0].innerHTML)
              let date = this._removeTagsHtml(cell[1].innerHTML)

              let buttonEl = cell[2].firstChild
              let form = this._extractJSFCLJS(buttonEl.getAttribute('onclick'), res.body)

              let newsClassIndex = this._news.findIndex((news) => {
                return form.postOptions.id == news.id
              })

              if (newsClassIndex == -1) {
                let newsClass = new SigaaNews({
                  name,
                  date,
                  form
                }, this.getNews.bind(this), this._data)
                this._news.push(newsClass)
                usedNewsIndex.push(this._news.length - 1 )

              } else {
                usedNewsIndex.push(newsClassIndex)
                this._news[newsClassIndex].update({name, date, form})
              }
              
            }
            this._news = this._news.filter((news, index) => {
              if (usedNewsIndex.indexOf(index) > -1) {
                return true
              } else {
                news.finish()
                return false
              }
            })
          } else {
            for (let row of rows) {
              let cell = row.children;
              let name = this._removeTagsHtml(cell[0].innerHTML)
              let date = this._removeTagsHtml(cell[1].innerHTML)

              let buttonEl = cell[2].firstChild
              let form = this._extractJSFCLJS(buttonEl.getAttribute('onclick'), res.body)
              this._news.push(new SigaaNews(
              {
                name,
                date,
                form
              },
                this.getNews.bind(this),
                this._data))

            }
            resolve(this._news)
          }

        })
      })
  }
  getAbsence(){
    return this._clickLeftSidebarButton("Frequência")
    .then(res => new Promise((resolve, reject) => {

      if (res.statusCode !== 200) reject({status:"ERROR", errorCode: statusCode})

      let { document } = new JSDOM(res.body).window;
      let table = document.querySelector(".listing");
      let absences = {
        list:[]
      } 
      if (!table) resolve(absences)
      let rows = table.querySelectorAll("tr[class]")
        for (let row of rows) {
          let cells = row.children;
          let date = this._removeTagsHtml(cells[0].innerHTML)
          let statusString = this._removeTagsHtml(cells[1].innerHTML)
          let status
          if(statusString === '') continue;
          else if(statusString === 'Presente') status = 0
          else status = parseInt(statusString.replace(/\D/gm, ''), 10)
          absences.list.push({
            date,
            status
          })  
      }
      let details = document.querySelector(".botoes-show").innerHTML.split("<br>")
      for(let detail of details){
        if(detail.includes("Total de Faltas")){
          absences.totalAbsences = parseInt(detail.replace(/\D/gm, ''), 10)
        }else if(detail.includes("Máximo de Faltas Permitido")){
          absences.maxAbsences = parseInt(detail.replace(/\D/gm, ''), 10)
        }
      }
      resolve(absences)

    }))
  }
  _clickLeftSidebarButton(buttonLabel) {
    return this._requestClassPage()
      .then(res => new Promise((resolve, reject) => {
        let { document } = new JSDOM(res.body).window;
        let getGradesBtnEl = Array.from(document.querySelectorAll('div.itemMenu')).find(el => {
          return el.textContent === buttonLabel;
        });
        let form = this._extractJSFCLJS(getGradesBtnEl.parentElement.getAttribute('onclick'), res.body);
        resolve(this._post(form.action, form.postOptions, this._data.token));
      }))
  }

  getGrades() {
    return this._clickLeftSidebarButton('Ver Notas') 
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
          var theadTrs = document.querySelectorAll('thead tr');
          var valueCells = document.querySelector('tbody tr').children;

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

                  if (gradeId !== "") {
                    let gradeName = document.querySelector(`input#denAval_${gradeId}`).value
                    let gradeAbbreviation = document.querySelector(`input#abrevAval_${gradeId}`).value
                    let gradeWeight = document.querySelector(`input#pesoAval_${gradeId}`).value
                    gradeGroup.grades.push({
                      name: gradeName,
                      abbreviation: gradeAbbreviation,
                      weight: gradeWeight,
                      value: parseFloat(this._removeTagsHtml(valueCells[j].innerHTML).replace(/,/g, '.'))
                    })
                  } else {
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
