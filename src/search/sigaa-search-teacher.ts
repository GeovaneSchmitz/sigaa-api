import { Parser } from '@helpers/sigaa-parser';
import { HTTP } from '@session/sigaa-http';
import { Page } from '@session/sigaa-page';
import { URL } from 'url';
import {
  TeacherResult,
  SigaaSearchTeacherResult
} from './sigaa-search-teacher-result';

export interface Campus {
  name: string;
  value: string;
}

export class SigaaSearchTeacher {
  page: Page | null = null;

  constructor(private http: HTTP, private parser: Parser) {}

  async loadSearchPage(): Promise<void> {
    if (!this.page) {
      this.page = await this.http.get(
        '/sigaa/public/docente/busca_docentes.jsf'
      );
    }
  }

  async getCampusList(): Promise<Campus[]> {
    await this.loadSearchPage();
    const page = this.page as Page;
    const campusOptionElements = page
      .$('select#form\\:departamento > option')
      .toArray();
    const list = [];
    for (const campusOptionElement of campusOptionElements) {
      list.push({
        name: this.parser.removeTagsHtml(page.$(campusOptionElement).html()),
        value: this.parser.removeTagsHtml(page.$(campusOptionElement).val())
      });
    }
    return list;
  }

  async search(teacherName: string, campus?: Campus): Promise<TeacherResult[]> {
    await this.loadSearchPage();
    const page = this.page as Page;

    let campusValue;
    if (!campus) {
      campusValue = '0';
    } else {
      campusValue = campus.value;
    }
    const formElement = page.$('form[name="form"]');
    const action = formElement.attr('action');
    if (!action)
      throw new Error('SIGAA: Form with action at teacher search page.');

    const url = new URL(action, page.url);

    const postValues: Record<string, string> = {};
    const inputs = formElement
      .find("input[name]:not([type='submit'])")
      .toArray();
    for (const input of inputs) {
      const name = page.$(input).attr('name');
      if (name) postValues[name] = page.$(input).val();
    }
    postValues['form:nome'] = teacherName;
    postValues['form:departamento'] = campusValue;
    postValues['form:buscar'] = 'Buscar';
    return this.http
      .post(url.href, postValues)
      .then((page) => this.parseSearchResults(page));
  }

  private async parseSearchResults(page: Page): Promise<TeacherResult[]> {
    const rowElements = page.$('table.listagem > tbody > tr[class]').toArray();
    const results = [];
    for (const rowElement of rowElements) {
      const name = this.parser.removeTagsHtml(
        page.$(rowElement).find('span.nome').html()
      );
      const department = this.parser.removeTagsHtml(
        page.$(rowElement).find('span.departamento').html()
      );
      const pageHREF = this.parser.removeTagsHtml(
        page.$(rowElement).find('span.pagina > a').attr('href')
      );
      const photoHREF = this.parser.removeTagsHtml(
        page.$(rowElement).find('img').attr('src')
      );
      const pageURL = new URL(pageHREF, page.url);
      const photoURL = photoHREF.includes('no_picture.png')
        ? undefined
        : new URL(photoHREF, page.url);

      results.push(
        new SigaaSearchTeacherResult(this.http, this.parser, {
          name,
          department,
          pageURL,
          photoURL
        })
      );
    }
    return results;
  }
}
