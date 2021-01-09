import {
  SigaaCourseStudent,
  SigaaCourseStudentData
} from '@courses/sigaa-course-student';
import { Parser } from '@helpers/sigaa-parser';
import { HTTP } from '@session/sigaa-http';

export interface StudentBond {
  readonly type: 'student';
  readonly program: string;
  readonly registration: string;
  /**
   * Get courses
   * @param [allPeriods=false] if true, all courses will be returned; otherwise, only current courses
   * @returns
   * @async
   */
  getCourses(allPeriods?: boolean): Promise<SigaaCourseStudent[]>;
}

/**
 * class to represent student bond
 */
export class SigaaStudentBond implements StudentBond {
  constructor(
    private http: HTTP,
    private parser: Parser,
    readonly program: string,
    readonly registration: string
  ) {}

  readonly type = 'student';

  async getCourses(allPeriods = false): Promise<SigaaCourseStudent[]> {
    const coursesPage = await this.http.get(
      '/sigaa/portais/discente/turmas.jsf'
    );

    const table = coursesPage.$('.listagem');
    if (table.length === 0) return [];
    const listCourses: SigaaCourseStudent[] = [];
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

          const courseData: SigaaCourseStudentData = {
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
          listCourses.push(
            new SigaaCourseStudent(courseData, this.http, this.parser)
          );
        }
      }
    }
    return listCourses;
  }
}
