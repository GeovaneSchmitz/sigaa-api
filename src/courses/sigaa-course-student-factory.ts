import { Parser } from '@helpers/sigaa-parser';
import { HTTP } from '@session/sigaa-http';
import { CourseResourcesManagerFactory } from './sigaa-course-resources-manager-factory';

import {
  CourseStudent,
  SigaaCourseStudent,
  CourseStudentData
} from './sigaa-course-student';
import { LessonParserFactory } from './sigaa-lesson-parser-factory';

/**
 * Abstraction to represent the class that instantiates the CourseStudent.
 * @category Internal
 */
export interface CourseFactory {
  createCourseStudent(courseData: CourseStudentData): CourseStudent;
}

/**
 * Default implementation of CourseFactory
 * @category Internal
 */
export class SigaaCourseFactory implements CourseFactory {
  constructor(
    private http: HTTP,
    private parser: Parser,
    private courseResourcesManagerFactory: CourseResourcesManagerFactory,
    private lessonParserFactory: LessonParserFactory
  ) {}

  createCourseStudent(courseData: CourseStudentData): SigaaCourseStudent {
    return new SigaaCourseStudent(
      courseData,
      this.http,
      this.parser,
      this.courseResourcesManagerFactory,
      this.lessonParserFactory
    );
  }
}
