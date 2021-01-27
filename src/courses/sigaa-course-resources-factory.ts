import { Parser } from '@helpers/sigaa-parser';
import { HTTP } from '@session/sigaa-http';

import { UpdatableResourceCallback } from '@resources/updatable-resource';
import { News, NewsData, SigaaNews } from './resources/sigaa-news-student';
import { Quiz, QuizData, SigaaQuiz } from '@attachments/sigaa-quiz-student';
import { FileData, SigaaFile, File } from '@resources/sigaa-file';

import {
  Lesson,
  LessonData,
  SigaaLesson
} from './resources/sigaa-lesson-student';

import {
  SigaaWebContent,
  WebContent,
  WebContentData
} from '@attachments/sigaa-web-content-student';

import {
  CourseForum,
  ForumData,
  SigaaCourseForum
} from '@attachments/sigaa-course-forum-student';

import {
  Homework,
  HomeworkData,
  SigaaHomework
} from '@attachments/sigaa-homework-student';
import {
  SigaaSurvey,
  Survey,
  SurveyData
} from '@attachments/sigaa-survey-student';

/**
 * Create instances of course resources.
 * @category Internal
 */
export interface CourseResourcesFactory {
  createWebContentFromWebContentData(
    http: HTTP,
    options: WebContentData,
    updateCallback: UpdatableResourceCallback
  ): WebContent;

  createLessonFromLessonData(
    http: HTTP,
    options: LessonData,
    updateCallback: UpdatableResourceCallback
  ): Lesson;

  createFileFromFileData(
    http: HTTP,
    options: FileData,
    updateCallback: UpdatableResourceCallback
  ): File;

  createHomeworkFromHomeworkData(
    http: HTTP,
    homeworkOptions: HomeworkData,
    updateCallback: UpdatableResourceCallback
  ): Homework;

  createForumFromForumData(
    http: HTTP,
    options: ForumData,
    updateCallback: UpdatableResourceCallback
  ): CourseForum;

  createNewsFromNewsData(
    http: HTTP,
    newsOptions: NewsData,
    updateCallback: UpdatableResourceCallback
  ): News;

  createQuizFromQuizData(
    http: HTTP,
    quizData: QuizData,
    updateCallback: UpdatableResourceCallback
  ): Quiz;

  createSurveyFromSurveyData(
    http: HTTP,
    surveyData: SurveyData,
    updateCallback: UpdatableResourceCallback
  ): Survey;
}

/**
 * Class to create instances of course resources.
 * @category Internal
 */
export class SigaaCourseResourcesFactory implements CourseResourcesFactory {
  constructor(private parser: Parser) {}

  createHomeworkFromHomeworkData(
    http: HTTP,
    options: HomeworkData,
    updateCallback: UpdatableResourceCallback
  ): SigaaHomework {
    return new SigaaHomework(http, this, options, updateCallback);
  }

  createWebContentFromWebContentData(
    http: HTTP,
    options: WebContentData,
    updateCallback: UpdatableResourceCallback
  ): SigaaWebContent {
    return new SigaaWebContent(http, this.parser, options, updateCallback);
  }

  createLessonFromLessonData(
    http: HTTP,
    options: LessonData,
    updateCallback: UpdatableResourceCallback
  ): SigaaLesson {
    return new SigaaLesson(options, updateCallback);
  }

  createFileFromFileData(
    http: HTTP,
    options: FileData,
    updateCallback: UpdatableResourceCallback
  ): SigaaFile {
    return new SigaaFile(http, options, updateCallback);
  }

  createForumFromForumData(
    http: HTTP,
    options: ForumData,
    updateCallback: UpdatableResourceCallback
  ): SigaaCourseForum {
    return new SigaaCourseForum(
      http,
      this.parser,
      this,
      options,
      updateCallback
    );
  }

  createNewsFromNewsData(
    http: HTTP,
    options: NewsData,
    updateCallback: UpdatableResourceCallback
  ): SigaaNews {
    return new SigaaNews(http, this.parser, options, updateCallback);
  }

  createQuizFromQuizData(
    http: HTTP,
    options: QuizData,
    updateCallback: UpdatableResourceCallback
  ): SigaaQuiz {
    return new SigaaQuiz(http, options, updateCallback);
  }

  createSurveyFromSurveyData(
    http: HTTP,
    options: SurveyData,
    updateCallback: UpdatableResourceCallback
  ): SigaaSurvey {
    return new SigaaSurvey(options, updateCallback);
  }
}
