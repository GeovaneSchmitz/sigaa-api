import { createHash } from 'crypto';

import { Page, SigaaForm } from '@session/sigaa-page';
import { LinkAttachment } from '@attachments/sigaa-link-student';
import { VideoAttachment } from '@attachments/sigaa-video-student';
import { Parser } from '@helpers/sigaa-parser';
import { Attachment, LessonData } from '@courseResources/sigaa-lesson-student';
import { Quiz } from '@attachments/sigaa-quiz-student';
import { Survey } from '@attachments/sigaa-survey-student';
import { FileData } from '@resources/sigaa-file';
import { ForumData } from '@attachments/sigaa-course-forum-student';
import { Homework } from '@attachments/sigaa-homework-student';

import { CourseResourcesManager } from '@courses/sigaa-course-resources-manager';

/**
 * @category Internal
 */
interface GenericAttachmentData {
  title: string;
  description: string;
  form: SigaaForm;
  id: string;
}

/**
 * @category Internal
 */
interface TextAttachment {
  type: 'text';
  body: string;
}

/**
 * @category Internal
 */
export interface LessonParser {
  parserPage(page: Page): void;
}

/**
 * @category Internal
 */
export class SigaaLessonParser implements LessonParser {
  constructor(
    private parser: Parser,
    private resources: CourseResourcesManager
  ) {}

  private forumsIdIndex = 0;

  /**
   * Parse the page and retrieves the HTML elements that are the topics of the lesson
   * @param page
   */
  private getElements(page: Page): cheerio.Element[] {
    const contentElement = page.$('#conteudo');

    return contentElement.find('.topico-aula').toArray();
  }

  parserPage(page: Page): void {
    this.resources.lessons.keepOnly([]);

    const lessonsElements = this.getElements(page);

    const usedLessonsIds: string[] = [];

    for (const lessonElement of lessonsElements) {
      const lessonOptions = this.lessonParser(page, lessonElement);
      usedLessonsIds.push(lessonOptions.id);
      this.resources.lessons.upsert(lessonOptions);
    }
    this.resources.lessons.keepOnly(usedLessonsIds);
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
            const forum = this.resources.forums.upsert(forumOptions);
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
    return this.resources.files.upsert(fileOptions);
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
    return this.resources.webContents.upsert(webContentOptions);
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
  ): Survey {
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
    return this.resources.survey.upsert(surveyOptions);
  }

  /**
   * Parse the homework attached to the lesson topic
   * @param page
   * @param attachmentElement
   */
  private parseAttachmentHomework(
    page: Page,
    attachmentElement: cheerio.Element
  ): Homework {
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

    return this.resources.homework.upsert(homeworkOptions);
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
  ): Quiz {
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
    return this.resources.quizzes.upsert(quizOptions);
  }
}
