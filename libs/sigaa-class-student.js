const Sigaa = require('./sigaa');
const { JSDOM } = require('jsdom');
('use strict');

class SigaaAccount extends Sigaa {
  constructor(urlBase, cache) {
    super(urlBase, cache);
  }
  getClasses(token) {
    return this._get(
      '/sigaa/portais/discente/discente.jsf',
      token
    ).then(res => {
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
            list.push({
              name,
              id,
              location,
              schedule,
            });
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
  _requestClassPage(classId, token) {
    return this._get('/sigaa/portais/discente/discente.jsf', token)
      .then(res => {
        return new Promise((resolve, reject) => {
          if (res.statusCode == 200) {
            let form = this._extractForm(res.body, 'form_acessarTurmaVirtual');

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
  getTopics(classId, token) {
    return this._requestClassPage(classId, token).then(res => {
      return new Promise((resolve, reject) => {
        let { document } = new JSDOM(res.body).window;
        let contentElement = document.getElementById('conteudo');
        let topicsElements;
        if (contentElement) {
          topicsElements = contentElement.querySelectorAll('.topico-aula');
        } else {
          reject(classId);
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
                Name: '',
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
              attachment.name = titleElement.innerHTML.trim();

              attachment.form = this._extractJSFCLJS(
                titleElement.getAttribute('onclick'),
                res.body
              );
              topicAttachments.push(attachment);
            }
          }

          let topic = {};
          topic.name = topicName;
          topic.contentText = topicContentText;
          topic.attachments = topicAttachments;

          topic.startDate = topicStartDate;
          topic.endDate = topicEndDate;
          topics.push(topic);
        }
        resolve(topics);
      });
    });
  }
  getNewsIndex(classId, token) {
    return this._requestClassPage(classId, token)
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
          resolve(this._post(form.action, form.postOptions, token));
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
  getNews(newsId, token) {
    return this._post(newsId.action, newsId.postOptions, token)
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
  getGrades(classId, token) {
    return this._requestClassPage(classId, token)
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
          resolve(this._post(form.action, form.postOptions, token));
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
                return i + 1;
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
                  let cellName = getCellByPositionColSpan(theadTrsThs[1], j)
                  gradeName = this._removeTagsHtml(cellName.innerHTML);
                  gradeGroup.grades.push({
                    name: gradeName
                  })
                }
              }
              grades.push(gradeGroup)
            }
          }

          if (false) {
            let cell = getCellByPositionColSpan(theadTrsThs[0], i)
            var gradeName = this._removeTagsHtml(cell.innerHTML);
            let gradeGroup = {
              name: gradeName
            }
            let colspan = theadTrsThs[0][i].colSpan;
            if (colspan > 1) {
              gradeGroup.grades = []
              for (let j = 0, colspan = theadTrsThs[0][i].colSpan; j < colspan; j++) {
                let gradeId = theadTrsThs[1][i + j].id.substring(5);

                let cell = getCellByPositionColSpan(theadTrsThs[0], i)
                var gradeName = this._removeTagsHtml(cell.innerHTML);
                if (gradeId == true) {
                  var gradeName = document.querySelector(`input#denAval_${gradeId}`).value
                }

              }
            } else {
              var gradeValue = parseFloat(this._removeTagsHtml(valueCells[i].innerHTML).replace(/,/g, '.'));
            }



            if (removeCellsWithName.indexOf(gradeName) == -1) {

              let grade = {
                name: gradeName,
                value: gradeValue,
              };
              grades.push(grade);
            }

          }
          resolve(grades);
        });
      });
  }
}

module.exports = SigaaAccount;
