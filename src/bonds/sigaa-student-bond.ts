import { CourseFactory } from '@courses/sigaa-course-student-factory';
import { Parser } from '@helpers/sigaa-parser';
import { HTTP } from '@session/sigaa-http';

import {
  CourseStudent,
  CourseStudentData
} from '@courses/sigaa-course-student';

/**
 * Abstraction to represent a student bond.
 * @category Public
 */
export interface StudentBond {
  readonly type: 'student';
  /**
   * It's the name of the student program, in IFSC it is called "curso".
   */
  readonly program: string;
  /**
   * It is the student registration code, in IFSC it is called "matrícula".
   */
  readonly registration: string;
  /**
   * Get courses, in IFSC it is called "Turmas Virtuais".
   * @param allPeriods if true, all courses will be returned; otherwise, only current courses.
   * @returns Promise with array of courses.
   */
  getCourses(allPeriods?: boolean): Promise<CourseStudent[]>;
}

/**
 * Class to represent student bond.
 * @category Internal
 */
export class SigaaStudentBond implements StudentBond {
  constructor(
    private http: HTTP,
    private parser: Parser,
    private courseFactory: CourseFactory,
    readonly program: string,
    readonly registration: string,
    readonly bondSwitchUrl: URL | null
  ) {}

  readonly type = 'student';

  /**
   * Get courses, in IFSC it is called "Turmas Virtuais".
   * @param allPeriods if true, all courses will be returned; otherwise, only current courses.
   * @returns Promise with array of courses.
   */
  async getCourses(allPeriods = false): Promise<CourseStudent[]> {
    const coursesPage = await this.http.get(
      '/sigaa/portais/discente/turmas.jsf'
    );

    const table = coursesPage.$('.listagem');
    if (table.length === 0) return [];
    const listCourses: CourseStudent[] = [];
    let period;
    let rows = table.find('tbody > tr').toArray();
    if (!allPeriods) {
      let lastPeriodIndex;
      for (let i = 0; i < rows.length; i++) {
        const cellElements = coursesPage.$(rows[i]).find('td');
        if (cellElements.eq(0).hasClass('periodo')) {
          lastPeriodIndex = i;
        }
      }
      rows = rows.slice(lastPeriodIndex);
    }
    for (const row of rows) {
      const cellElements = coursesPage.$(row).find('td');
      if (cellElements.eq(0).hasClass('periodo')) {
        period = this.parser.removeTagsHtml(cellElements.html());
      } else if (period) {
        const buttonCoursePage = cellElements.eq(5).find('a[onclick]');
        if (buttonCoursePage) {
          const fullname = this.parser.removeTagsHtml(
            cellElements.eq(0).html()
          );
          const buttonCoursePage = cellElements.eq(5).find('a[onclick]');
          const buttonOnClickCode = buttonCoursePage.attr('onclick');

          if (!buttonOnClickCode) throw new Error('SIGAA: Invalid row.');
          const form = coursesPage.parseJSFCLJS(buttonOnClickCode);

          const courseData: CourseStudentData = {
            title: fullname.slice(fullname.indexOf(' - ') + 3),
            code: fullname.slice(0, fullname.indexOf(' - ')),
            numberOfStudents: parseInt(
              this.parser.removeTagsHtml(cellElements.eq(2).html())
            ),
            schedule: this.parser.removeTagsHtml(cellElements.eq(4).html()),
            period,
            id: form.postValues['idTurma'],
            form
          };
          listCourses.push(this.courseFactory.createCourseStudent(courseData));
        }
      }
    }
    return listCourses;
  }
}
