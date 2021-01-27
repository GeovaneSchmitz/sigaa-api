import { Parser } from '@helpers/sigaa-parser';
import { CourseResourcesManager } from './sigaa-course-resources-manager';
import { LessonParser, SigaaLessonParser } from './sigaa-lesson-parser';

/**
 * @category Internal
 */
export interface LessonParserFactory {
  createLessonParser(resources: CourseResourcesManager): LessonParser;
}

/**
 *  @category Internal
 */
export class SigaaLessonParserFactory implements LessonParserFactory {
  constructor(private parser: Parser) {}

  createLessonParser(resources: CourseResourcesManager): LessonParser {
    return new SigaaLessonParser(this.parser, resources);
  }
}
