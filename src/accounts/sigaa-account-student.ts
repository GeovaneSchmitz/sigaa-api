import {
  SigaaCourseStudent,
  SigaaCourseStudentData
} from '@courses/sigaa-course-student';
import { ProgressCallback } from '@session/sigaa-http';
import { Page } from '@session/sigaa-page';
import { URL } from 'url';
import { SigaaAccount } from './sigaa-account';

/**
 * class to represent student account
 */
export class SigaaAccountStudent extends SigaaAccount {
  readonly userType = 'student';

  async verifyIfUserType(page: Page): Promise<boolean> {
    if (page.url.href.includes('discente')) return true;

    if (page.url.href.includes('/telasPosSelecaoVinculos.jsf')) {
      if (page.url.href.includes('/sigaa/verPortalDiscente.do')) return true;
      return false;
    }

    if (page.url.href.includes('mobile'))
      return page.body.includes('form-portal-discente');
    return false;
  }

  /**
   * Get courses
   * @param [allPeriods=false] if true, all courses will be returned; otherwise, only current courses
   * @returns
   * @async
   */
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

  /**
   * Get profile picture URL
   * @returns URL of profile picture
   */
  async getProfilePictureURL(): Promise<URL> {
    const page = await this.http.get('/sigaa/mobile/touch/menu.jsf');

    const pictureElement = page.$('div[data-role="fieldcontain"] img');
    if (pictureElement.length === 0)
      throw new Error('SIGAA: User has no picture.');

    const pictureSrc = pictureElement.attr('src');
    if (!pictureSrc || pictureSrc.includes('/img/avatar.jpg'))
      throw new Error('SIGAA: User has no picture.');

    return new URL(pictureSrc, page.url);
  }

  /**
   * Download user profile picture, save in filepath
   * File path can be a directory
   * @param basepath Path to save the image
   * @returns Full filepath of image
   */
  async downloadProfilePicture(
    basepath: string,
    callback?: ProgressCallback
  ): Promise<string> {
    const pictureURL = await this.getProfilePictureURL();
    return this.http.downloadFileByGet(pictureURL.href, basepath, callback);
  }

  /**
   * get user's name
   * @return {string}
   */
  async getName(): Promise<string> {
    const page = await this.http.get('/sigaa/portais/discente/discente.jsf');
    if (page.statusCode === 200) {
      const username = this.parser.removeTagsHtml(
        page.$('p.usuario > span').html()
      );
      return username;
    } else {
      throw new Error('SIGAA: unexpected status code at student profile page.');
    }
  }
}
