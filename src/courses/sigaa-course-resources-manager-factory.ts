import { CourseResourcesFactory } from '@courses/sigaa-course-resources-factory';
import { CourseResourcesManager } from '@courses/sigaa-course-resources-manager';
import { HTTP } from '@session/sigaa-http';
import { CourseStudent } from './sigaa-course-student';

/**
 * Abstraction to represent the class that create instances of CourseResourceManager.
 * @category Internal
 */
export interface CourseResourcesManagerFactory {
  createCourseResourcesManager(
    http: HTTP,
    course: CourseStudent
  ): CourseResourcesManager;
}
/**
 * Class to create instances of CourseResourceManager.
 * @category Internal
 */
export class SigaaCourseResourceManagerFactory
  implements CourseResourcesManagerFactory {
  constructor(private courseResourcesFactory: CourseResourcesFactory) {}

  createCourseResourcesManager(
    http: HTTP,
    course: CourseStudent
  ): CourseResourcesManager {
    return new CourseResourcesManager(
      http,
      this.courseResourcesFactory,
      course
    );
  }
}
