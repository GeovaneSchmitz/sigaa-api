import { URL } from 'url';

import { Lesson } from '@courseResources/sigaa-lesson-student';
import { NewsData, News } from '@courseResources/sigaa-news-student';
import { Parser } from '@helpers/sigaa-parser';
import { File } from '@resources/sigaa-file';
import { HTTP } from '@session/sigaa-http';

import { SigaaForm, Page } from '@session/sigaa-page';
import { QuizData, Quiz } from '@attachments/sigaa-quiz-student';
import { HomeworkData, Homework } from '@attachments/sigaa-homework-student';
import { SigaaSurvey } from '@attachments/sigaa-survey-student';
import { CourseResourcesManagerFactory } from './sigaa-course-resources-manager-factory';
import { Exam } from '@courseResources/sigaa-exam-student';
import { Syllabus } from '@courseResources/sigaa-syllabus-student';
import { LessonParserFactory } from './sigaa-lesson-parser-factory';

import {
  GradeGroup,
  SubGradeSumOfGrades,
  SubGradeWeightedAverage
} from '@courseResources/sigaa-grades-student';

import {
  ForumData,
  CourseForum
} from '@courseResources/forum/sigaa-course-forum-student';

import {
  WebContent,
  WebContentData
} from '@attachments/sigaa-web-content-student';
import {
  AbsenceDay,
  AbsenceList
} from '@courseResources/sigaa-absence-list-student';

import {
  MemberList,
  Student,
  Teacher
} from '@courseResources/sigaa-member-list-student';

/**
 * @category Internal
 */
export interface CourseStudentData {
  id: string;
  title: string;
  code: string;
  numberOfStudents: number;
  period: string;
  schedule: string;
  form: SigaaForm;
}

/**
 * Course in the student's view.
 * @category Public
 **/
export interface CourseStudent {
  /**
   * Single string indicating the course.
   *
   * String única indicando o curso.
   */
  readonly id: string;

  /**
   * Course title (Nome da turma).
   */
  readonly title: string;

  /**
   * Course name abbreviation.
   *
   * Código (abreviação) da turma.
   */
  readonly code: string;

  /**
   * Course Schedule.
   *
   * Horário das aulas.
   */
  readonly schedule: string;

  /**
   * Number of students, is 0 if the course of the period is not the current one.
   */
  readonly numberOfStudents: number;

  /**
   * Course Semester.
   */
  readonly period: string;

  /**
   * Returns the list of lessons.
   */
  getLessons(): Promise<Lesson[]>;

  /**
   * Returns to the list of files provided by the teacher.
   */
  getFiles(): Promise<File[]>;

  /**
   * Returns the courses forum.
   */
  getForums(): Promise<CourseForum[]>;

  /**
   * Returns the courses news.
   */
  getNews(): Promise<News[]>;

  /**
   * Returns your absences.
   */
  getAbsence(): Promise<AbsenceList>;

  /**
   * Parse the side evaluation card and returns the name of each evaluation and the date if it has
   */
  getExamCalendar(): Promise<Exam[]>;

  /**
   * Returns the courses quizzes.
   */
  getQuizzes(): Promise<Quiz[]>;

  /**
   * Returns the course WebContent Array.
   */
  getWebContents(): Promise<WebContent[]>;

  /**
   * To do
   */
  getSurveys(): Promise<SigaaSurvey[]>;

  /**
   * Returns yours homework.
   */
  getHomeworks(): Promise<Homework[]>;

  /**
   * Get members object.
   */
  getMembers(): Promise<MemberList>;

  /**
   * Get grades array.
   */
  getGrades(): Promise<GradeGroup[]>;

  /**
   * Get Syllabus (Plano de ensino).
   */
  getSyllabus(): Promise<Syllabus>;
}

/**
 * Course in the student's view.
 *
 * @category Internal
 **/
export class SigaaCourseStudent implements CourseStudent {
  /**
   * @inheritdoc
   */
  readonly title;

  /**
   * @inheritdoc
   */
  readonly code;

  /**
   * @inheritdoc
   */
  readonly numberOfStudents;

  /**
   * @inheritdoc
   */
  readonly schedule;

  /**
   * @inheritdoc
   */
  readonly id;

  /**
   * @inheritdoc
   */
  readonly period;

  private form;

  private resources;

  private lessonParser;

  currentPageCache?: Page;

  constructor(
    courseData: CourseStudentData,
    private http: HTTP,
    private parser: Parser,
    resourcesManagerFactory: CourseResourcesManagerFactory,
    lessonParserFactory: LessonParserFactory
  ) {
    this.id = courseData.id;
    this.title = courseData.title;
    this.code = courseData.code;
    this.numberOfStudents = courseData.numberOfStudents;
    this.period = courseData.period;
    this.schedule = courseData.schedule;
    this.form = courseData.form;

    this.resources = resourcesManagerFactory.createCourseResourcesManager(
      this.http,
      this
    );
    this.lessonParser = lessonParserFactory.createLessonParser(this.resources);
  }

  /**
   * Request the course page using the course ID,
   * it is slower than requestCoursePageUsingForm,
   * but works if the form is invalid.
   * @returns Response page.
   */
  private async requestCoursePageUsingId() {
    const page = await this.http.get('/sigaa/portais/discente/turmas.jsf');
    if (page.statusCode !== 200)
      throw new Error('SIGAA: Unexpected courses page status code.');

    const table = page.$('.listagem');
    if (table.length === 0) {
      throw new Error('SIGAA: Unexpected courses page format.');
    }
    const rows = table.find('tbody > tr').toArray();
    const foundCourse = rows.some((row) => {
      const cellElements = page.$(row).find('td');
      if (cellElements.eq(0).hasClass('periodo')) return false;
      const buttonOnClick = cellElements
        .eq(5)
        .find('a[onclick]')
        .attr('onclick');
      if (!buttonOnClick)
        throw new Error('SIGAA: Unexpected row format at courses page.');
      const form = page.parseJSFCLJS(buttonOnClick);
      if (form.postValues.idTurma === this.form.postValues.idTurma) {
        this.form = form;
        return true;
      }
    });
    if (!foundCourse) {
      throw new Error('SIGAA: Not found course with id:' + this.id);
    }
    return this.requestCoursePageUsingForm();
  }

  /**
   * Request the course page using the course POST Form,
   * it is faster than requestCoursePageUsingId,
   * but don`t works if the form is invalid or expired.
   */
  private async requestCoursePageUsingForm() {
    const page = await this.http.post(
      this.form.action.href,
      this.form.postValues,
      {
        shareSameRequest: true
      }
    );
    if (page.statusCode === 200) {
      if (page.bodyDecoded.includes('Comportamento Inesperado!')) {
        throw new Error('SIGAA: Unexpected behavior on the course page.');
      }
      return page;
    } else {
      throw new Error('SIGAA: Unexpected course page status code.');
    }
  }

  /**
   * Request the course page using requestCoursePageUsingForm,
   * fallback to requestCoursePageUsingId.
   * @returns Response page.
   */
  private async requestCoursePage(): Promise<Page> {
    if (this.currentPageCache) return this.currentPageCache;
    return this.requestCoursePageUsingForm().catch(() =>
      this.requestCoursePageUsingId()
    );
  }

  /**
   * Receive the name of the side tab and load the tab page
   * @param buttonLabel
   * @param retry
   */
  private async getCourseSubMenu(
    buttonLabel: string,
    retry = false
  ): Promise<Page> {
    const page = await this.requestCoursePage();

    const getBtnEl = page
      .$('div.itemMenu')
      .toArray()
      .find((buttonEl) => {
        return (
          this.parser.removeTagsHtml(page.$(buttonEl).html()) === buttonLabel
        );
      });
    if (!getBtnEl) {
      throw new Error('SIGAA: Course sub menu button not found.');
    }
    const buttonOnClick = page.$(getBtnEl).parent().attr('onclick');
    if (!buttonOnClick)
      throw new Error(
        'SIGAA: Course sub menu button does not have the onclick event.'
      );
    const form = page.parseJSFCLJS(buttonOnClick);
    try {
      const pageResponse = await this.http.post(
        form.action.href,
        form.postValues
      );
      if (page.statusCode !== 200)
        throw new Error('SIGAA: Invalid course page status code.');

      if (pageResponse.bodyDecoded.includes('Menu Turma Virtual')) {
        this.currentPageCache = pageResponse;
      }
      return pageResponse;
    } catch (err) {
      if (retry) {
        this.currentPageCache = undefined;
        return this.getCourseSubMenu(buttonLabel, false);
      }
      throw err;
    }
  }

  /**
   * Receive the name of the card on the right of the page and return it
   * @param page
   * @param cardTitle
   */
  private async getRightSidebarCard(
    page: Page,
    cardTitle: string
  ): Promise<cheerio.Cheerio> {
    const titleElement = page
      .$('.rich-stglpanel-header.headerBloco')
      .toArray()
      .find((titleElement) => {
        return (
          this.parser.removeTagsHtml(page.$(titleElement).html()) === cardTitle
        );
      });
    if (!titleElement) {
      throw new Error('SIGAA: Course sidebar card not found.');
    } else {
      return page.$(titleElement).parent().parent();
    }
  }

  /**
   * @inheritdoc
   */
  async getLessons(): Promise<Lesson[]> {
    const page = await this.requestCoursePage();
    this.lessonParser.parserPage(page);
    return this.resources.lessons.instances;
  }

  /**
   * @inheritdoc
   */
  async getFiles(): Promise<File[]> {
    const page = await this.getCourseSubMenu('Arquivos');
    const table = page.$('.listing');
    const usedFilesId = [];
    if (table.length !== 0) {
      const rows = table.find('tr[class]').toArray();
      for (const row of rows) {
        const cells = page.$(row).children();
        const title = this.parser.removeTagsHtml(cells.first().html());
        const description = this.parser.removeTagsHtml(cells.eq(1).html());
        const buttonElement = cells.eq(3).find('a[onclick]');
        const buttonOnclick = buttonElement.attr('onclick');
        if (!buttonOnclick)
          throw new Error(
            'SIGAA: Button in the file table does not have the onclick event.'
          );

        const form = page.parseJSFCLJS(buttonOnclick);
        const id = form.postValues['id'];
        const key = form.postValues['key'];
        const fileOptions = {
          title,
          description,
          id,
          key,
          instanceIndentifier: id
        };
        this.resources.files.upsert(fileOptions);
        usedFilesId.push(id);
      }
    }
    this.resources.files.keepOnly(usedFilesId);
    return this.resources.files.instances;
  }

  /**
   * @inheritdoc
   */
  async getForums(): Promise<CourseForum[]> {
    const page = await this.getCourseSubMenu('Fóruns');

    const table = page.$('.listing');
    const usedForumIds: string[] = [];
    if (table.length !== 0) {
      let forumsIdIndex = 0;
      const rows = table.find('tr[class]').toArray();
      for (const row of rows) {
        const cells = page.$(row).children();
        const titleElement = cells.first().find('a');
        const title = this.parser.removeTagsHtml(titleElement.html());
        const forumType = this.parser.removeTagsHtml(cells.eq(1).html());
        const numOfTopics = parseInt(
          this.parser.removeTagsHtml(cells.eq(2).html()),
          10
        );
        const author = this.parser.removeTagsHtml(cells.eq(3).html());
        const creationDate = this.parser.parseDates(
          this.parser.removeTagsHtml(cells.eq(4).html()),
          1
        )[0];
        const titleOnClick = titleElement.attr('onclick');
        if (!titleOnClick)
          throw new Error('SIGAA: Forum title does not have onclick event.');

        const form = page.parseJSFCLJS(titleOnClick);
        const id = forumsIdIndex;
        forumsIdIndex++;
        const forumOptions: ForumData = {
          title,
          id: id.toString(),
          instanceIndentifier: id.toString(),
          forumType,
          numOfTopics: numOfTopics,
          author,
          creationDate,
          form
        };
        this.resources.forums.upsert(forumOptions);
        usedForumIds.push(id.toString());
      }
    }
    this.resources.forums.keepOnly(usedForumIds);
    return this.resources.forums.instances;
  }

  /**
   * @inheritdoc
   */
  async getNews(): Promise<News[]> {
    const page = await this.getCourseSubMenu('Notícias');
    const table = page.$('.listing');
    const usedNewsId = [];
    if (table.length !== 0) {
      const rows = table.find('tr[class]').toArray();
      for (const row of rows) {
        const cell = page.$(row).children();
        const title = this.parser.removeTagsHtml(cell.first().html());

        const buttonElement = cell.eq(2).children().first();
        const buttonOnClick = buttonElement.attr('onclick');
        if (!buttonOnClick)
          throw new Error(
            'SIGAA: News onclick button does not have onclick event.'
          );

        const form = page.parseJSFCLJS(buttonOnClick);
        const id = form.postValues.id;
        const newsOptions: NewsData = {
          title,
          form,
          id,
          instanceIndentifier: id
        };
        this.resources.news.upsert(newsOptions);
        usedNewsId.push(id);
      }
    }
    this.resources.news.keepOnly(usedNewsId);
    return this.resources.news.instances;
  }

  /**
   * @inheritdoc
   */
  async getAbsence(): Promise<AbsenceList> {
    const page = await this.getCourseSubMenu('Frequência');
    const table = page.$('.listing');
    const absences: AbsenceDay[] = [];
    const rows = table.find('tr[class]').toArray();
    for (const row of rows) {
      const cells = page.$(row).children();
      const date = this.parser.removeTagsHtml(cells.first().html());
      const absenceString = this.parser.removeTagsHtml(cells.eq(1).html());
      let numOfAbsences;
      if (absenceString === '' || absenceString === 'Não Informada') {
        continue;
      } else if (absenceString === 'Presente') {
        numOfAbsences = 0;
      } else {
        numOfAbsences = parseInt(absenceString.replace(/\D/gm, ''), 10);
      }
      absences.push({
        date: this.parser.parseDates(date, 1)[0],
        numOfAbsences
      });
    }
    const details = this.parser
      .removeTagsHtml(page.$('.botoes-show').html())
      .split('\n');

    let totalAbsences, maxAbsences;

    for (const detail of details) {
      if (detail.includes('Total de Faltas')) {
        totalAbsences = parseInt(detail.replace(/\D/gm, ''), 10);
      } else if (detail.includes('Máximo de Faltas Permitido')) {
        maxAbsences = parseInt(detail.replace(/\D/gm, ''), 10);
      }
    }

    if (typeof maxAbsences !== 'number' || typeof totalAbsences !== 'number')
      throw new Error('SIGAA: Invalid absence page format.');

    return {
      list: absences,
      totalAbsences,
      maxAbsences
    };
  }

  /**
   * Parse the side evaluation card and returns the name of each evaluation and the date if it has
   */
  async getExamCalendar(): Promise<Exam[]> {
    const page = await this.requestCoursePage();
    const card = await this.getRightSidebarCard(page, 'Avaliações');
    const examElements = card.find('li').toArray();
    const examList: Exam[] = [];
    const yearString = this.period.split('.')[0];
    for (const examElement of examElements) {
      const description = this.parser.removeTagsHtml(
        page.$(examElement).find('span.descricao').html()
      );
      const dateHtml = page.$(examElement).find('span.data').html();
      const dateString = this.parser.removeTagsHtml(dateHtml);
      let date;
      try {
        date = this.parser.parseDates(
          dateString,
          1,
          parseInt(yearString, 10)
        )[0];
      } catch (err) {
        try {
          date = this.parser.parseDates(dateString, 2)[0];
          // eslint-disable-next-line no-empty
        } catch (err) {}
      }

      examList.push({
        description,
        date
      });
    }
    return examList;
  }

  /**
   * @inheritdoc
   */
  async getQuizzes(): Promise<Quiz[]> {
    const page = await this.getCourseSubMenu('Questionários');

    const table = page.$('.listing');

    const usedQuizzesIds = [];
    if (table.length === 0) return [];
    const rows = table.find('tr[class]').toArray();

    for (const row of rows) {
      const cells = page.$(row).find('td');
      const title = this.parser.removeTagsHtml(cells.first().html());
      const startDate = this.parser.parseDates(
        this.parser.removeTagsHtml(cells.eq(1).html()),
        1
      )[0];
      const endDate = this.parser.parseDates(
        this.parser.removeTagsHtml(cells.eq(2).html()),
        1
      )[0];
      const buttonSendAnswersElement = cells.eq(3).find('a[onclick]');
      let formSendAnswers;
      if (buttonSendAnswersElement) {
        const buttonOnclick = buttonSendAnswersElement.attr('onclick');
        if (!buttonOnclick)
          throw new Error(
            'SIGAA: quiz button onclick does not have onclick event.'
          );
        formSendAnswers = page.parseJSFCLJS(buttonOnclick);
      }
      const buttonViewAnswersSubmittedElement = cells.eq(4).find('a[onclick]');
      let formViewAnswersSubmitted;
      if (buttonViewAnswersSubmittedElement) {
        const buttonOnclick = buttonViewAnswersSubmittedElement.attr('onclick');
        if (!buttonOnclick)
          throw new Error(
            'SIGAA: quiz button onclick does not have onclick event.'
          );
        formViewAnswersSubmitted = page.parseJSFCLJS(buttonOnclick);
      }
      const form = formSendAnswers || formViewAnswersSubmitted;
      let id;
      if (!form) {
        if (!this.resources.lessons.instances.length) {
          await this.getLessons();
        }
        const quiz = this.resources.quizzes.instances.find(
          (quiz) => quiz.title === title
        );
        if (quiz) {
          id = quiz.id;
        } else {
          throw new Error('SIGAA: Not found quiz by title.');
        }
      } else {
        id = form.postValues.id;
      }

      const quizOptions: QuizData = {
        title,
        startDate,
        endDate,
        id,
        instanceIndentifier: id,
        formSendAnswers,
        formViewAnswersSubmitted
      };
      this.resources.quizzes.upsert(quizOptions);
      usedQuizzesIds.push(id);
    }
    this.resources.quizzes.keepOnly(usedQuizzesIds);
    return this.resources.quizzes.instances;
  }

  /**
   * @inheritdoc
   */
  async getWebContents(): Promise<WebContent[]> {
    const page = await this.getCourseSubMenu('Conteúdo/Página web');

    const table = page.$('.listing');

    const usedWebContentsIds = [];
    if (table.length !== 0) {
      const rows = table.find('tr[class]').toArray();

      for (const row of rows) {
        const cells = page.$(row).find('td');
        const title = this.parser.removeTagsHtml(cells.first().html());
        const dateString = this.parser.removeTagsHtml(cells.eq(1).html());
        const date = this.parser.parseDates(dateString, 1)[0];
        const buttonOnclick = page
          .$(cells[2])
          .find('a[onclick]')
          .attr('onclick');

        if (!buttonOnclick)
          throw new Error(
            'SIGAA: Webcontent has button without onclick event.'
          );

        const form = page.parseJSFCLJS(buttonOnclick);
        const id = form.postValues.id;
        const webContentOptions: WebContentData = {
          title,
          date,
          form,
          id,
          instanceIndentifier: id
        };
        this.resources.webContents.upsert(webContentOptions);
        usedWebContentsIds.push(id);
      }
    }
    this.resources.webContents.keepOnly(usedWebContentsIds);
    return this.resources.webContents.instances;
  }

  /**
   * @inheritdoc
   */
  async getSurveys(): Promise<SigaaSurvey[]> {
    // TODO
    throw new Error('SIGAA: getSurveys not implemented.');
  }

  /**
   * @inheritdoc
   */
  async getHomeworks(): Promise<Homework[]> {
    const page = await this.getCourseSubMenu('Tarefas');

    const tables = page.$('.listing').toArray();

    if (!tables) return [];
    const usedHomeworksIds = [];
    for (const table of tables) {
      //If table title is 'Tarefas Em Grupo'
      const isGroupHomework =
        this.parser.removeTagsHtml(page.$(table).siblings('legend').html()) ===
        'Tarefas Em Grupo';

      const rows = page.$(table).find('tr[class]').toArray();

      for (let i = 0; i < rows.length; i += 2) {
        const cells = page.$(rows[i]).find('td');
        const cellDescription = page.$(rows[i + 1]).find('td');
        const title = this.parser.removeTagsHtml(cells.eq(1).html());
        const description = this.parser.removeTagsHtml(cellDescription.html());
        const date = this.parser.removeTagsHtml(cells.eq(2).html());
        const dates = this.parser.parseDates(date, 2);
        const haveGrade =
          this.parser.removeTagsHtml(cells.eq(3).html()) !== 'Não';

        const buttonSendHomeworkElement = page.$(
          cells.eq(5).find('a[onclick]')
        );
        let formSendHomework;
        if (buttonSendHomeworkElement.length !== 0) {
          const onClick = buttonSendHomeworkElement.attr('onclick');
          if (!onClick)
            throw new Error(
              'SIGAA: Button send homework without onclick event.'
            );
          formSendHomework = page.parseJSFCLJS(onClick);
        }
        const buttonViewHomeworkSubmittedElement = page.$(
          cells.eq(6).find('a[onclick]')
        );
        let formViewHomeworkSubmitted;
        if (buttonViewHomeworkSubmittedElement.length !== 0) {
          const onClick = buttonViewHomeworkSubmittedElement.attr('onclick');
          if (!onClick)
            throw new Error(
              'SIGAA: Button view homework without onclick event.'
            );
          formViewHomeworkSubmitted = page.parseJSFCLJS(onClick);
        }
        const form = formSendHomework || formViewHomeworkSubmitted;
        let id: string | undefined;
        let instanceIndentifier: string | undefined;
        if (!form) {
          if (!this.resources.lessons.instances.length) {
            await this.getLessons();
          }

          const homeworkList = this.resources.homework.instances.filter(
            (homework) => homework.title === title
          );

          if (homeworkList.length > 1) {
            throw new Error(
              'SIGAA: There is more than one homework with same title and without id.'
            );
          } else if (homeworkList.length == 1) {
            id = homeworkList[0]._instanceIndentifier;
          } else {
            instanceIndentifier = '_' + title;
          }
        } else {
          id = form.postValues.id;
        }
        if (id) {
          instanceIndentifier = id;
        }
        if (instanceIndentifier) {
          const homeworkOptions: HomeworkData = {
            title,
            startDate: dates[0],
            endDate: dates[1],
            description,
            isGroupHomework,
            id,
            instanceIndentifier,
            formSendHomework,
            formViewHomeworkSubmitted,
            haveGrade
          };
          this.resources.homework.upsert(homeworkOptions);
          usedHomeworksIds.push(instanceIndentifier);
        }
      }
    }
    this.resources.homework.keepOnly(usedHomeworksIds);
    return this.resources.homework.instances;
  }

  /**
   * @inheritdoc
   */
  async getMembers(): Promise<MemberList> {
    const page = await this.getCourseSubMenu('Participantes');

    const tables = page.$('table.participantes').toArray();
    const tablesNames = page.$('fieldset').toArray();
    if (tables.length !== tablesNames.length) {
      throw new Error('SIGAA: Unexpected page members format.');
    }
    let tableTeacher;
    let tableStudent;
    tablesNames.forEach((value, index) => {
      const label = this.parser.removeTagsHtml(page.$(value).html());
      if (label.includes('Professores')) tableTeacher = tables[index];
      else if (label.includes('Alunos')) tableStudent = tables[index];
    });
    const teachers: Teacher[] = [];
    if (tableTeacher) {
      const teacherElements = page.$(tableTeacher).find('tr').toArray();
      for (const teacherElement of teacherElements) {
        let department;
        let formation;
        let username;
        let email;
        const informationsString =
          page.$(teacherElement).find('td[valign]').html() || '';
        const informations = informationsString.split('<br>').slice(1, -1);
        for (const information of informations) {
          const label = this.parser.removeTagsHtml(
            (information.match(/^[\s\S]*?(?=:[\s]*?<em>)/g) || [])[0]
          );
          const informationContent = this.parser.removeTagsHtml(
            (information.match(/(?=<em>)[\s\S]*?(?=<\/em>)/g) || [])[0]
          );
          switch (label) {
            case 'Departamento':
              department = informationContent;
              break;
            case 'Formação':
              formation = informationContent;
              break;
            case 'Usuário':
              username = informationContent;
              break;
            case 'E-mail':
            case 'E-Mail':
              email = informationContent;
              break;
            default:
              console.log(
                'WARNING:Teacher information label not recognized:' + label
              );
          }
        }
        const name = this.parser.removeTagsHtml(
          page.$(teacherElement).find('strong > a').html()
        );
        if (!username || !email)
          throw new Error('SIGAA: Invalid teacher format at member page.');
        const teacher: Teacher = {
          name,
          username,
          department,
          formation,
          email
        };
        const photoHREF = page.$(teacherElement).find('img').attr('src');
        if (!photoHREF)
          throw new Error(
            'SIGAA: teacher profile picture without src at member page.'
          );

        const photoURL = new URL(photoHREF, page.url.href);
        if (!photoURL.href.includes('no_picture.png')) {
          teacher.photoURL = photoURL;
        }

        teachers.push(teacher);
      }
    }

    const students: Student[] = [];
    if (tableStudent) {
      const rows = page.$(tableStudent).find('tr').toArray();
      for (const row of rows) {
        const numberOfColumn = page.$(row).find('td[valign]').length;
        for (let column = 0; column < numberOfColumn; column++) {
          const informationsString =
            page.$(row).find('td[valign]').eq(column).html() || '';
          const informations = informationsString.split('<br>').slice(1);
          let registration;
          let username;
          let program;
          let registrationDate;
          let email;
          for (const information of informations) {
            const label = this.parser.removeTagsHtml(
              (information.match(/^[\s\S]*?(?=:[\s]*?<em>)/g) || [])[0]
            );
            const informationContent = this.parser.removeTagsHtml(
              (information.match(/(?=<em>)[\s\S]*?(?=<\/em>)/g) || [])[0]
            );
            switch (label) {
              case 'Matrícula': {
                registration = informationContent;
                break;
              }
              case 'Usuário': {
                username = informationContent;
                break;
              }
              case 'Curso': {
                program = informationContent;
                break;
              }
              case 'Data Matrícula': {
                const informationDateSplited = informationContent.split('-');
                const year = parseInt(informationDateSplited[2], 10);
                const month = parseInt(informationDateSplited[1], 10) - 1;
                const day = parseInt(informationDateSplited[0], 10);
                registrationDate = new Date(year, month, day);
                break;
              }
              case 'E-mail':
              case 'E-Mail': {
                email = informationContent;
                break;
              }
              default: {
                console.log(
                  'WARNING:Student information label not recognized:' + label
                );
              }
            }
          }

          if (
            !username ||
            !email ||
            !registrationDate ||
            !registration ||
            !program
          )
            throw new Error('SIGAA: Invalid student format at member page.');

          const name = this.parser.removeTagsHtml(
            page.$(row).find('strong').eq(column).html()
          );

          const student: Student = {
            name,
            username,
            program,
            registration,
            registrationDate,
            email
          };

          const photoHREF = page
            .$(row)
            .find('td[width="47"] img')
            .eq(column)
            .attr('src');
          if (!photoHREF)
            throw new Error(
              'SIGAA: student profile picture without src at member page.'
            );

          const photoURL = new URL(photoHREF, page.url.href);
          if (!photoURL.href.includes('no_picture.png')) {
            student.photoURL = photoURL;
          }

          students.push(student);
        }
      }
    }

    return {
      teachers,
      students
    };
  }

  /**
   * @inheritdoc
   */
  async getGrades(): Promise<GradeGroup[]> {
    const page = await this.getCourseSubMenu('Ver Notas');
    const getPositionByCellColSpan = (
      ths: cheerio.Cheerio,
      cell: cheerio.Element
    ) => {
      let i = 0;
      for (const tr of ths.toArray()) {
        if (cell === tr) {
          return i;
        }
        i += parseInt(page.$(tr).attr('colspan') || '1', 10);
      }
      throw new Error('SIGAA: Invalid grade table.');
    };

    const removeCellsWithName = ['', 'Matrícula', 'Nome', 'Sit.', 'Faltas'];

    const table = page.$('table.tabelaRelatorio');
    if (table.length < 1)
      throw new Error('SIGAA: Received empty table on grade page.');

    const theadTrs = page.$('thead tr').toArray();
    const valueCells = page.$(table).find('tbody tr').children();
    if (valueCells.length === 0) {
      throw new Error('SIGAA: Page grades without grades.');
    }
    const grades: GradeGroup[] = [];

    const theadElements: cheerio.Cheerio[] = [];
    for (const theadTr of theadTrs) {
      theadElements.push(page.$(theadTr).find('th'));
    }

    for (let i = 0; i < theadElements[0].length; i++) {
      const gradeGroupName = this.parser.removeTagsHtml(
        theadElements[0].eq(i).html()
      );
      if (removeCellsWithName.indexOf(gradeGroupName) !== -1) continue;
      const index = getPositionByCellColSpan(
        theadElements[0],
        theadElements[0][i]
      );
      const theadElementColspan = parseInt(
        theadElements[0].eq(i).attr('colspan') || '1',
        10
      );
      if (theadElementColspan === 1) {
        const valueString = this.parser
          .removeTagsHtml(valueCells.eq(index).html())
          .replace(/,/g, '.');
        let value;
        if (valueString.length > 0) {
          value = parseFloat(valueString);
        }
        grades.push({
          name: gradeGroupName,
          value,
          type: 'only-average'
        });
      } else {
        let type = 'weighted-average';
        const gradesSumOfGrades: SubGradeSumOfGrades[] = [];
        const gradesWeighted: SubGradeWeightedAverage[] = [];
        for (let j = index; j < index + theadElementColspan; j++) {
          const fullId = theadElements[1].eq(j).attr('id');
          if (!fullId) throw new Error('SIGAA: Grade without id.');
          const gradeId = fullId.slice(5);

          if (gradeId !== '') {
            const gradeName = page.$(`input#denAval_${gradeId}`).val();
            const gradeCode = page.$(`input#abrevAval_${gradeId}`).val();
            const maxValue = parseFloat(
              page.$(`input#notaAval_${gradeId}`).val()
            );

            const gradeWeight = parseFloat(
              page.$(`input#pesoAval_${gradeId}`).val()
            );

            let value: number | undefined = parseFloat(
              this.parser
                .removeTagsHtml(valueCells.eq(j).html())
                .replace(/,/g, '.')
            );

            if (!isNaN(gradeWeight)) {
              type = 'weighted-average';
            }
            if (!isNaN(maxValue)) {
              type = 'sum-of-grades';
            }
            if (!value && value !== 0) value = undefined;
            if (type === 'sum-of-grades') {
              gradesSumOfGrades.push({
                name: gradeName,
                code: gradeCode,
                maxValue: maxValue,
                value
              });
            } else {
              gradesWeighted.push({
                name: gradeName,
                code: gradeCode,
                weight: gradeWeight,
                value
              });
            }
          } else {
            let average: number | undefined = parseFloat(
              this.parser
                .removeTagsHtml(valueCells.eq(j).html())
                .replace(/,/g, '.')
            );
            if (isNaN(average)) average = undefined;

            if (gradesSumOfGrades.length > 0 && gradesWeighted.length > 0) {
              throw new Error('SIGAA: Invalid grade type.');
            }
            if (type === 'sum-of-grades') {
              grades.push({
                name: gradeGroupName,
                value: average,
                grades: gradesSumOfGrades,
                type
              });
            } else if (type === 'weighted-average') {
              grades.push({
                name: gradeGroupName,
                value: average,
                grades: gradesWeighted,
                type
              });
            }
          }
        }
      }
    }
    return grades;
  }

  /**
   * @inheritdoc
   */
  async getSyllabus(): Promise<Syllabus> {
    const page = await this.getCourseSubMenu('Plano de Ensino');
    const tables = page.$('table.listagem').toArray();

    const response: Syllabus = {
      schedule: [],
      evaluations: [],
      basicReferences: [],
      supplementaryReferences: []
    };
    for (const table of tables) {
      const titleElement = page.$(table).find('caption');
      const title = this.parser.removeTagsHtml(titleElement.html());

      const rows = page.$(table).children('tbody').children('tr').toArray();
      switch (title) {
        case 'Metodologia de Ensino e Avaliação': {
          for (const row of rows) {
            const rowBodyElement = page.$(row).children('td');
            const body = this.parser.removeTagsHtmlKeepingEmphasis(
              rowBodyElement.html()
            );
            const rowFieldElement = page.$(row).children('th');

            const rowField = this.parser.removeTagsHtml(rowFieldElement.html());
            if (rowField === 'Metodologia:') {
              response.methods = body;
            } else if (
              rowField === 'Procedimentos de Avaliação da Aprendizagem:'
            ) {
              response.assessmentProcedures = body;
            } else if (rowField === 'Horário de atendimento:') {
              response.attendanceSchedule = body;
            } else {
              throw new Error('SIGAA: Label not found.');
            }
          }
          break;
        }
        case 'Cronograma de Aulas': {
          const schedule = [];
          for (const row of rows) {
            const startDateElement = page.$(row).children('td').eq(0);
            const endDateElement = page.$(row).children('td').eq(1);
            const bodyElement = page.$(row).children('td').eq(2);

            const startDateString = this.parser.removeTagsHtml(
              startDateElement.html()
            );

            let startDate;
            if (startDateString) {
              try {
                const dates = this.parser.parseDates(startDateString, 1);
                startDate = dates[0];
                // eslint-disable-next-line no-empty
              } catch (err) {}
            }

            const endDateString = this.parser.removeTagsHtml(
              endDateElement.html()
            );

            let endDate;
            if (endDateString) {
              try {
                const dates = this.parser.parseDates(endDateString, 1);
                endDate = dates[0];
                // eslint-disable-next-line no-empty
              } catch (err) {}
            }

            const description = this.parser.removeTagsHtml(bodyElement.html());

            schedule.push({
              description,
              startDate,
              endDate
            });
          }
          response.schedule = schedule;
          break;
        }
        case 'Avaliações': {
          const evaluations: Exam[] = [];
          for (const row of rows) {
            const dateElement = page.$(row).children('td').eq(0);

            const descriptionElement = page.$(row).children('td').eq(1);
            const dateString = this.parser.removeTagsHtml(dateElement.html());
            let date;
            if (dateString) {
              try {
                const dates = this.parser.parseDates(dateString, 1);
                date = dates[0];
                // eslint-disable-next-line no-empty
              } catch (err) {}
            }

            const descriptionText = this.parser.removeTagsHtml(
              descriptionElement.html()
            );

            evaluations.push({
              description: descriptionText,
              date
            });
          }
          response.evaluations = evaluations;

          break;
        }
        case 'Referências Básicas':
        case 'Referências Complementares': {
          const references = [];
          for (const row of rows) {
            const referenceTypeElement = page.$(row).find('td').eq(0);

            const referenceType = this.parser.removeTagsHtml(
              referenceTypeElement.html()
            );
            const descriptionElement = page.$(row).children('td').eq(1);

            const descriptionText = this.parser.removeTagsHtmlKeepingEmphasis(
              descriptionElement.html()
            );
            references.push({
              description: descriptionText,
              type: referenceType
            });
          }
          if (title === 'Referências Básicas') {
            response.basicReferences = references;
          } else if (title === 'Referências Complementares') {
            response.supplementaryReferences = references;
          }

          break;
        }
        default:
          console.log(
            'WARNING:Education plan table title not recognized:' + title
          );
      }
    }
    return response;
  }
}
