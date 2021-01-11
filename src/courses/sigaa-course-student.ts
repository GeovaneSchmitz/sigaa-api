import { createHash } from 'crypto';
import { URL } from 'url';

import {
  SigaaCourseForum,
  ForumData
} from '@attachments/sigaa-course-forum-student';
import {
  SigaaHomework,
  HomeworkData
} from '@attachments/sigaa-homework-student';
import { SigaaQuiz, QuizData } from '@attachments/sigaa-quiz-student';
import { SigaaSurvey, SurveyData } from '@attachments/sigaa-survey-student';
import {
  SigaaWebContent,
  WebContentData
} from '@attachments/sigaa-web-content-student';
import { SigaaLesson, LessonData } from '@courseResources/sigaa-lesson-student';
import { SigaaNews, NewsData } from '@courseResources/sigaa-news-student';
import { Parser } from '@helpers/sigaa-parser';

import { SigaaFile, FileData } from '@resources/sigaa-file';
import { UpdatableResource } from '@resources/updatable-resource';
import { HTTP } from '@session/sigaa-http';
import { SigaaForm, Page } from '@session/sigaa-page';
import { CourseStudent } from './sigaa-course';

/**
 * @category Internal
 */
export interface SigaaCourseStudentData {
  id: string;
  title: string;
  code: string;
  numberOfStudents: number;
  period: string;
  schedule: string;
  form: SigaaForm;
}

/**
 * @category Internal
 */
interface TextAttachment {
  type: 'text';
  body: string;
}

/**
 * @category Public
 */
export interface Exam {
  description: string;
  date?: Date;
}

/**
 * @category Internal
 */
interface WithId {
  id: string;
}

/**
 * @category Internal
 */
export interface GenericAttachmentData {
  title: string;
  description: string;
  form: SigaaForm;
  id: string;
}

/**
 * @category Public
 */
export interface VideoAttachment {
  type: 'video';
  src: string;
  title: string;
  description: string;
}

/**
 * @category Internal
 */
export interface LinkAttachment {
  type: 'link';
  title: string;
  href: string;
  description: string;
}

interface Instances {
  lessons: SigaaLesson[];
  homework: SigaaHomework[];
  quizzes: SigaaQuiz[];
  files: SigaaFile[];
  videos: VideoAttachment[];
  forums: SigaaCourseForum[];
  survey: SigaaSurvey[];
  news: SigaaNews[];
  webContents: SigaaWebContent[];
}

/**
 * @category Public
 */
export interface AbsenceDay {
  date: Date;
  numOfAbsences: number;
}

/**
 * @category Public
 */
export interface AbsenceList {
  list: AbsenceDay[];
  totalAbsences: number;
  maxAbsences: number;
}

/**
 * @category Public
 */
export type Attachment =
  | SigaaFile
  | SigaaHomework
  | SigaaQuiz
  | SigaaCourseForum
  | SigaaWebContent
  | SigaaSurvey
  | LinkAttachment
  | VideoAttachment;

/**
 * @category Internal
 */
export interface Member {
  name: string;
  username: string;
  email: string;
  photoURL?: URL;
}

/**
 * @category Public
 */
export interface Teacher extends Member {
  formation?: string;
  department?: string;
}

/**
 * @category Public
 */
export interface Student extends Member {
  registration: string;
  program: string;
  registrationDate: Date;
}

/**
 * @category Public
 */
export interface MemberList {
  students: Student[];
  teachers: Teacher[];
}

/**
 * @category Public
 */
export interface SyllabusDay {
  description: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * @category Public
 */
export interface SyllabusReference {
  type?: string;
  description: string;
}

/**
 * @category Public
 */
export interface Syllabus {
  methods?: string;
  assessmentProcedures?: string;
  attendanceSchedule?: string;
  schedule: SyllabusDay[];
  evaluations: Exam[];
  basicReferences: SyllabusReference[];
  supplementaryReferences: SyllabusReference[];
}

interface UpdaterOptions<T extends UpdatableResource<U>, U> {
  instanceOptions: U;
  constructor: (options: U) => T;
}

/**
 * @category Public
 */
export interface Grade {
  name: string;
  value?: number;
}

/**
 * @category Public
 */
export interface SubGrade extends Grade {
  code: string;
}

/**
 * @category Public
 */
export interface SubGradeSumOfGrades extends SubGrade {
  maxValue: number;
}

/**
 * @category Public
 */
export interface SubGradeWeightedAverage extends SubGrade {
  weight: number;
}

/**
 * @category Public
 */
export interface GradeGroupOnlyAverage extends Grade {
  type: 'only-average';
}

/**
 * @category Public
 */
export interface GradeGroupWeightedAverage extends Grade {
  grades: SubGradeWeightedAverage[];
  type: 'weighted-average';
}

/**
 * @category Public
 */
export interface GradeGroupSumOfGrades extends Grade {
  grades: SubGradeSumOfGrades[];
  type: 'sum-of-grades';
}

/**
 * @category Public
 */
export type GradeGroup =
  | GradeGroupSumOfGrades
  | GradeGroupOnlyAverage
  | GradeGroupWeightedAverage;

/**
 * course in the student's view
 *
 * @category Public
 **/
export class SigaaCourseStudent implements CourseStudent {
  /**
   * Course title
   * Nome da turma
   */
  readonly title;

  /**
   * Course name abbreviation
   * Código (abreviação) da turma
   */
  readonly code;

  /**
   * Number of students, is 0 if the course of the period is not the current one
   */
  readonly numberOfStudents;

  /**
   * Course Schedule
   * Horário das aulas
   */
  readonly schedule;

  /**
   * Single string indicating the course
   * String única indicando o curso
   */
  readonly id;
  readonly period;
  private form;
  private forumsIdIndex = 0;
  private instances: Instances = {
    lessons: [],
    files: [],
    homework: [],
    forums: [],
    quizzes: [],
    videos: [],
    survey: [],
    webContents: [],
    news: []
  };
  currentPageCache?: Page;

  constructor(
    courseData: SigaaCourseStudentData,
    private http: HTTP,
    private parser: Parser
  ) {
    this.id = courseData.id;
    this.title = courseData.title;
    this.code = courseData.code;
    this.numberOfStudents = courseData.numberOfStudents;
    this.period = courseData.period;
    this.schedule = courseData.schedule;
    this.form = courseData.form;
  }

  /**
   * Request the course page using the course ID,
   * it is slower than requestCoursePageUsingForm,
   * but works if the form is invalid
   * @return response page
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
   * but don`t works if the form is invalid or expired
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
      if (page.body.includes('Comportamento Inesperado!')) {
        throw new Error('SIGAA: Unexpected behavior on the course page.');
      }
      return page;
    } else {
      throw new Error('SIGAA: Unexpected course page status code.');
    }
  }

  /**
   * Request the course page using requestCoursePageUsingForm,
   * fallback to requestCoursePageUsingId
   * @return {<Promise>Object} response page
   */
  private async requestCoursePage(): Promise<Page> {
    if (this.currentPageCache) return this.currentPageCache;
    return this.requestCoursePageUsingForm().catch(() =>
      this.requestCoursePageUsingId()
    );
  }

  /**
   * Returns the list of lessons
   * Retorna a lista aulas
   */
  async getLessons(): Promise<SigaaLesson[]> {
    const page = await this.requestCoursePage();
    const lessonsElements = this.lessonGetElements(page);
    const usedLessonsIds: string[] = [];
    this.forumsIdIndex = 0;
    this.closeClassInstances(this.instances.lessons, usedLessonsIds);
    for (const lessonElement of lessonsElements) {
      const lessonOptions = this.lessonParser(page, lessonElement);
      usedLessonsIds.push(lessonOptions.id);
      this.updateClassInstances(this.instances.lessons, {
        instanceOptions: lessonOptions,
        constructor: (lessonData: LessonData) =>
          new SigaaLesson(lessonData, async () => {
            await this.getLessons();
          })
      });
    }
    this.closeClassInstances(this.instances.lessons, usedLessonsIds);
    return this.instances.lessons;
  }

  /**
   * Parse the page and retrieves the HTML elements that are the topics of the lesson
   * @param page
   */
  private lessonGetElements(page: Page): cheerio.Element[] {
    const contentElement = page.$('#conteudo');

    return contentElement.find('.topico-aula').toArray();
  }

  /**
   * Parse each lesson topic HTML element
   * @param page
   */
  private lessonParser(page: Page, lessonElement: cheerio.Element): LessonData {
    const titleElement = page.$(lessonElement).find('.titulo');
    const titleFull = this.parser.removeTagsHtml(titleElement.html());
    const lessonDatesString = titleFull.slice(
      titleFull.lastIndexOf('(') + 1,
      titleFull.lastIndexOf(')')
    );
    let startDate, endDate;
    try {
      const lessonDate = this.parser.parseDates(lessonDatesString, 2);
      startDate = lessonDate[0];
      endDate = lessonDate[1];
    } catch (err) {
      const lessonDate = this.parser.parseDates(lessonDatesString, 1);
      startDate = lessonDate[0];
      endDate = lessonDate[0];
    }

    const title = titleFull.slice(0, titleFull.lastIndexOf('(')).trim();
    const lessonContentElement = page.$(lessonElement).find('.conteudotopico');

    const lessonHTML = lessonContentElement.html();
    if (!lessonHTML) throw new Error('SIGAA: Lesson without content.');

    const lessonContent = this.parser.removeTagsHtml(
      lessonHTML.replace(/<div([\S\s]*?)div>/gm, '')
    );

    const attachments = this.parseAttachmentsFromLesson(
      page,
      lessonContentElement
    );
    const contentText = attachments.reduce((reducer, attachment) => {
      if (attachment.type === 'text') return `${reducer}\n${attachment.body}`;
      return reducer;
    }, lessonContent);

    const lesson: LessonData = {
      title,
      contentText,
      startDate,
      id: createHash('sha512')
        .update(`${title} - ${startDate.toString()} - ${endDate.toString()}`)
        .digest('hex'),
      endDate,
      attachments: attachments.filter(
        (attachment) => attachment.type !== 'text'
      ) as Attachment[]
    };

    return lesson;
  }

  /**
   * Returns to the list of files provided by the teacher
   */
  async getFiles(): Promise<SigaaFile[]> {
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
        const fileOptions = { title, description, id, key };
        this.updateClassInstances(this.instances.files, {
          instanceOptions: fileOptions,
          constructor: (fileOptions: FileData) =>
            new SigaaFile(this.http, fileOptions, async () => {
              await this.getFiles();
            })
        });
        usedFilesId.push(id);
      }
    }
    this.closeClassInstances(this.instances.files, usedFilesId);
    return this.instances.files;
  }
  /**
   * Receive each class topic and parse each attachment in them
   * @param page
   * @param lessonContentElement
   */
  private parseAttachmentsFromLesson(
    page: Page,
    lessonContentElement: cheerio.Cheerio
  ): (Attachment | TextAttachment)[] {
    const lessonAttachments: (Attachment | TextAttachment)[] = [];
    const attachmentElements = lessonContentElement
      .find('span[id] > div.item')
      .toArray();
    if (attachmentElements.length !== 0) {
      for (const attachmentElement of attachmentElements) {
        const iconElement = page.$(attachmentElement).find('img');
        const iconSrc = iconElement.attr('src');
        try {
          if (iconSrc === undefined) {
            const attachmentText: TextAttachment = {
              type: 'text',
              body: this.parser.removeTagsHtml(page.$(attachmentElement).html())
            };
            lessonAttachments.push(attachmentText);
          } else if (iconSrc.includes('questionario.png')) {
            const quiz = this.parseAttachmentQuiz(page, attachmentElement);
            lessonAttachments.push(quiz);
          } else if (iconSrc.includes('video.png')) {
            const video = this.parseAttachmentVideo(page, attachmentElement);
            lessonAttachments.push(video);
          } else if (iconSrc.includes('tarefa.png')) {
            const homework = this.parseAttachmentHomework(
              page,
              attachmentElement
            );
            lessonAttachments.push(homework);
          } else if (iconSrc.includes('pesquisa.png')) {
            const survey = this.parseAttachmentSurvey(page, attachmentElement);
            lessonAttachments.push(survey);
          } else if (iconSrc.includes('conteudo.png')) {
            const webContents = this.parseAttachmentWebContent(
              page,
              attachmentElement
            );
            lessonAttachments.push(webContents);
          } else if (iconSrc.includes('forumava.png')) {
            const genericOptions = this.parseAttachmentGeneric(
              page,
              attachmentElement
            );
            const forumOptions: ForumData = {
              ...genericOptions,
              id: this.forumsIdIndex.toString(),
              isMain: true
            };

            this.forumsIdIndex++;
            const forum = this.updateClassInstances(this.instances.forums, {
              instanceOptions: forumOptions,
              constructor: (options: ForumData) =>
                new SigaaCourseForum(
                  this.http,
                  this.parser,
                  options,
                  async () => {
                    await this.getForums();
                  }
                )
            });
            lessonAttachments.push(forum);
          } else if (iconSrc.includes('portal_turma/site_add.png')) {
            const link = this.parseAttachmentLink(page, attachmentElement);
            lessonAttachments.push(link);
          } else {
            const file = this.parseAttachmentFile(page, attachmentElement);
            lessonAttachments.push(file);
          }
        } catch (error) {
          error.iconSrc = iconSrc;
          error.htmlAttachment = page.$(attachmentElement).html();
          throw error;
        }
      }
    }
    return lessonAttachments;
  }

  /**
   * Parse the file attached to the lesson topic
   * @param page
   * @param attachmentElement
   */
  private parseAttachmentFile(page: Page, attachmentElement: cheerio.Element) {
    const fileOptions: FileData = this.parseAttachmentGeneric(
      page,
      attachmentElement
    );
    return this.updateClassInstances(this.instances.files, {
      instanceOptions: fileOptions,
      constructor: (fileOptions: FileData) =>
        new SigaaFile(this.http, fileOptions, async () => {
          await this.getFiles();
        })
    });
  }

  /**
   * Parse the web content attached to the lesson topic
   * @param page
   * @param attachmentElement
   */
  private parseAttachmentWebContent(
    page: Page,
    attachmentElement: cheerio.Element
  ) {
    const webContentOptions = this.parseAttachmentGeneric(
      page,
      attachmentElement
    );
    const webContents = this.updateClassInstances(this.instances.webContents, {
      instanceOptions: webContentOptions,

      constructor: (webContentOptions: WebContentData) =>
        new SigaaWebContent(
          this.http,
          this.parser,
          webContentOptions,
          async () => {
            await this.getWebContents();
          }
        )
    });
    return webContents;
  }

  /**
   * Parse a generic attachment (a link) attached to the lesson topic
   * @param page
   * @param attachmentElement
   */
  private parseAttachmentGeneric(
    page: Page,
    attachmentElement: cheerio.Element
  ): GenericAttachmentData {
    const titleElement = page
      .$(attachmentElement)
      .find('span')
      .children()
      .first();
    const title = this.parser.removeTagsHtml(titleElement.html());
    const titleOnClick = titleElement.attr('onclick');
    if (!titleOnClick)
      throw new Error('SIGAA: Attachment title without onclick event.');
    const form = page.parseJSFCLJS(titleOnClick);
    const id = form.postValues.id;
    const descriptionElement = page
      .$(attachmentElement)
      .find('div.descricao-item');
    const description = this.parser.removeTagsHtml(descriptionElement.html());
    return {
      title,
      form,
      id,
      description
    };
  }

  /**
   * Parse the survey (Enquete) attached to the lesson topic
   * @param page
   * @param attachmentElement
   */
  private parseAttachmentSurvey(
    page: Page,
    attachmentElement: cheerio.Element
  ): SigaaSurvey {
    const titleElement = page.$(attachmentElement).find('span > a');
    const title = this.parser.removeTagsHtml(titleElement.html());
    const titleOnClick = titleElement.attr('onclick');
    if (!titleOnClick)
      throw new Error('SIGAA: Survey title without onclick event.');
    const form = page.parseJSFCLJS(titleOnClick);
    const surveyOptions = {
      title,
      form,
      id: form.postValues.id
    };
    return this.updateClassInstances(this.instances.survey, {
      instanceOptions: surveyOptions,
      constructor: (surveyOptions: SurveyData) =>
        new SigaaSurvey(surveyOptions, async () => {
          await this.getSurveys();
        })
    });
  }

  /**
   * Parse the homework attached to the lesson topic
   * @param page
   * @param attachmentElement
   */
  private parseAttachmentHomework(
    page: Page,
    attachmentElement: cheerio.Element
  ): SigaaHomework {
    const titleElement = page.$(attachmentElement).find('span > a');
    const titleOnClick = titleElement.attr('onclick');
    if (!titleOnClick)
      throw new Error('SIGAA: Homework title without onclick event.');
    const form = page.parseJSFCLJS(titleOnClick);
    const id = form.postValues.id;
    const title = this.parser.removeTagsHtml(titleElement.html());
    const descriptionElement = page
      .$(attachmentElement)
      .find('div.descricao-item');
    const description = this.parser.removeTagsHtml(descriptionElement.html());
    const dates = this.parser.parseDates(description, 2);
    const startDate = dates[0];
    const endDate = dates[1];
    const homeworkOptions = {
      id,
      title,
      startDate,
      endDate
    };

    return this.updateClassInstances(this.instances.homework, {
      instanceOptions: homeworkOptions,
      constructor: (homeworkOptions: HomeworkData) =>
        new SigaaHomework(this.http, homeworkOptions, async () => {
          await this.getHomeworks();
        })
    });
  }

  /**
   * Parse the video attached to the lesson topic
   * @param page
   * @param attachmentElement
   */
  private parseAttachmentVideo(
    page: Page,
    attachmentElement: cheerio.Element
  ): VideoAttachment {
    const titleElement = page
      .$(attachmentElement)
      .find('span[id] > span[id] a');
    const href = titleElement.attr('href');
    const descriptionElement = page
      .$(attachmentElement)
      .find('div.descricao-item');

    const description = this.parser.removeTagsHtml(descriptionElement.html());
    let title = this.parser.removeTagsHtml(titleElement.html());
    let src: string;
    if (href) {
      title = title.replace(/\(Link Externo\)$/g, '');
      src = href;
    } else {
      const titleElement = page
        .$(attachmentElement)
        .find('span[id] > span[id]');
      title = this.parser.removeTagsHtml(titleElement.html());
      const srcIframe = page.$(attachmentElement).find('iframe').attr('src');
      if (!srcIframe) throw new Error('SIGAA: Video iframe without url.');
      src = srcIframe;
    }

    return {
      type: 'video',
      title,
      src,
      description
    };
  }

  /**
   * Parse the external link attached to the lesson topic
   * @param page
   * @param attachmentElement
   */
  private parseAttachmentLink(
    page: Page,
    attachmentElement: cheerio.Element
  ): LinkAttachment {
    const type = 'link';

    const titleElement = page.$(attachmentElement).find('span[id] > a');
    const title = this.parser.removeTagsHtml(titleElement.html());
    const href = titleElement.attr('href');
    if (!href) throw new Error('SIGAA: Link attachment does not have href.');

    const descriptionElement = page
      .$(attachmentElement)
      .find('div.descricao-item');
    const description = this.parser.removeTagsHtml(descriptionElement.html());
    return {
      type,
      title,
      href,
      description
    };
  }

  /**
   * Parse the quiz (questionário) attached to the lesson topic
   * @param page
   * @param attachmentElement
   */
  private parseAttachmentQuiz(
    page: Page,
    attachmentElement: cheerio.Element
  ): SigaaQuiz {
    const titleElement = page.$(attachmentElement).find('span > a');
    const title = this.parser.removeTagsHtml(titleElement.html());
    const onClick = titleElement.attr('onclick');

    if (!onClick)
      throw new Error('SIGAA: Quiz attachment without onclick event.');

    const form = page.parseJSFCLJS(onClick);
    const id = form.postValues.id;
    const descriptionElement = page

      .$(attachmentElement)
      .find('div.descricao-item');
    const description = this.parser.removeTagsHtml(descriptionElement.html());
    const dates = this.parser.parseDates(description, 2);
    const startDate = dates[0];
    const endDate = dates[1];

    const quizOptions = {
      title,
      id,
      startDate,
      endDate
    };
    return this.updateClassInstances(this.instances.quizzes, {
      instanceOptions: quizOptions,
      constructor: (quizOptions: QuizData) =>
        new SigaaQuiz(this.http, quizOptions, async () => {
          await this.getQuizzes();
        })
    });
  }

  /**
   * Returns the courses forum
   */
  async getForums(): Promise<SigaaCourseForum[]> {
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
          forumType,
          numOfTopics: numOfTopics,
          author,
          creationDate,
          form,
          isMain: true
        };
        this.updateClassInstances(this.instances.forums, {
          instanceOptions: forumOptions,
          constructor: (options: ForumData) =>
            new SigaaCourseForum(this.http, this.parser, options, async () => {
              await this.getForums();
            })
        });
        usedForumIds.push(id.toString());
      }
    }
    this.closeClassInstances(this.instances.forums, usedForumIds);
    return this.instances.forums;
  }

  /**
   * Returns the courses news
   */
  async getNews(): Promise<SigaaNews[]> {
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
        const newsOptions: NewsData = { title, form, id };
        this.updateClassInstances(this.instances.news, {
          instanceOptions: newsOptions,
          constructor: (newsOptions: NewsData) =>
            new SigaaNews(this.http, this.parser, newsOptions, async () => {
              await this.getNews();
            })
        });
        usedNewsId.push(id);
      }
    }
    this.closeClassInstances(this.instances.news, usedNewsId);
    return this.instances.news;
  }

  /**
   * Returns your absences
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

      if (page.body.includes('Menu Turma Virtual')) {
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

  async getQuizzes(): Promise<SigaaQuiz[]> {
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
        if (!this.instances.lessons) {
          await this.getLessons();
        }
        const quiz = this.instances.quizzes.find(
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
        formSendAnswers,
        formViewAnswersSubmitted
      };
      this.updateClassInstances(this.instances.quizzes, {
        instanceOptions: quizOptions,
        constructor: (quizOptions: QuizData) =>
          new SigaaQuiz(this.http, quizOptions, async () => {
            await this.getQuizzes();
          })
      });
      usedQuizzesIds.push(id);
    }
    this.closeClassInstances(this.instances.quizzes, usedQuizzesIds);
    return this.instances.quizzes;
  }

  async getWebContents(): Promise<SigaaWebContent[]> {
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
          id
        };

        this.updateClassInstances(this.instances.webContents, {
          instanceOptions: webContentOptions,
          constructor: (options: WebContentData) =>
            new SigaaWebContent(this.http, this.parser, options, async () => {
              await this.getWebContents();
            })
        });
        usedWebContentsIds.push(id);
      }
    }
    this.closeClassInstances(this.instances.webContents, usedWebContentsIds);
    return this.instances.webContents;
  }

  /**
   * To do
   */
  async getSurveys(): Promise<SigaaSurvey[]> {
    // TODO
    throw new Error('SIGAA: getSurveys not implemented.');
  }

  async getHomeworks(): Promise<SigaaHomework[]> {
    const page = await this.getCourseSubMenu('Tarefas');

    const table = page.$('.listing');

    if (!table) return [];
    const rows = table.find('tr[class]').toArray();
    const usedHomeworksIds = [];

    for (let i = 0; i < rows.length; i += 2) {
      const cells = page.$(rows[i]).find('td');
      const cellDescription = page.$(rows[i + 1]).find('td');
      const title = this.parser.removeTagsHtml(cells.eq(1).html());
      const description = this.parser.removeTagsHtml(cellDescription.html());
      const date = this.parser.removeTagsHtml(cells.eq(2).html());
      const dates = this.parser.parseDates(date, 2);
      let haveGrade = true;
      if (this.parser.removeTagsHtml(cells.eq(3).html()) === 'Não')
        haveGrade = false;
      const buttonSendHomeworkElement = page.$(cells.eq(5).find('a[onclick]'));
      let formSendHomework;
      if (buttonSendHomeworkElement.length !== 0) {
        const onClick = buttonSendHomeworkElement.attr('onclick');
        if (!onClick)
          throw new Error('SIGAA: Button send homework without onclick event.');
        formSendHomework = page.parseJSFCLJS(onClick);
      }
      const buttonViewHomeworkSubmittedElement = page.$(
        cells.eq(6).find('a[onclick]')
      );
      let formViewHomeworkSubmitted;
      if (buttonViewHomeworkSubmittedElement.length !== 0) {
        const onClick = buttonViewHomeworkSubmittedElement.attr('onclick');
        if (!onClick)
          throw new Error('SIGAA: Button view homework without onclick event.');
        formViewHomeworkSubmitted = page.parseJSFCLJS(onClick);
      }
      const form = formSendHomework || formViewHomeworkSubmitted;
      let id;
      if (!form) {
        if (!this.instances.lessons) {
          await this.getLessons();
        }
        const homework = this.instances.homework.find(
          (homework) => homework.title === title
        );
        if (homework) {
          id = homework.id;
        } else {
          throw new Error('SIGAA: Homework not found by title.');
        }
      } else {
        id = form.postValues.id;
      }
      const homeworkOptions: HomeworkData = {
        title,
        startDate: dates[0],
        endDate: dates[1],
        description,
        id,
        formSendHomework,
        formViewHomeworkSubmitted,
        haveGrade
      };

      this.updateClassInstances(this.instances.homework, {
        instanceOptions: homeworkOptions,
        constructor: (options: HomeworkData) =>
          new SigaaHomework(this.http, options, async () => {
            await this.getHomeworks();
          })
      });
      usedHomeworksIds.push(id);
    }
    this.closeClassInstances(this.instances.homework, usedHomeworksIds);
    return this.instances.homework;
  }

  /**
   * Closes and removes the instance if not in idsToKeep.
   * @param instances array of current instances.
   * @param idsToKeep array with ids to keep E.g. ["1234", "4321"]
   */
  private closeClassInstances<T>(
    instances: UpdatableResource<T>[],
    idsToKeep: string[]
  ): UpdatableResource<T>[] {
    return (instances = instances.filter((instance) => {
      try {
        if (idsToKeep.includes(instance.id)) {
          return true;
        } else {
          instance.close();
          return false;
        }
      } catch (err) {
        return false;
      }
    }));
  }

  /**
   * Update instance with new information
   * If there is an instance with the ID equal to options.id and
   * the same type, the update method will be called with
   * instanceOptions
   * E.g. instance.update(options.instanceOptions)
   * or create new instance with constructor
   * @param options
   * @param options.instanceOptions Object with new informations
   * @param options.constructor Constructor if no instance with id
   * @return return the instance updated/created
   */
  private updateClassInstances<
    T extends UpdatableResource<U>,
    U extends WithId
  >(instances: T[], options: UpdaterOptions<T, U>): T {
    const { instanceOptions, constructor } = options;

    const instance = instances.find((classItem) => {
      try {
        return instanceOptions.id === classItem.id;
      } catch (err) {
        return false;
      }
    });

    if (!instance) {
      const newInstance = constructor(instanceOptions);
      instances.push(newInstance);
      return newInstance;
    } else {
      instance.update(instanceOptions);
      return instance;
    }
  }

  /**
   * Get members object
   * @returns {Promise<object>}
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
   * Get grades array
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
    if (table.length !== 1)
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
   * Get Syllabus (Plano de ensino)
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
