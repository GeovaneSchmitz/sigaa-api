import { Parser } from '@helpers/sigaa-parser';
import {
  UpdatableResource,
  UpdatableResourceCallback
} from '@resources/updatable-resource';
import { HTTP } from '@session/sigaa-http';
import { SigaaForm } from '@session/sigaa-page';

/**
 * @category Internal
 */
export interface NewsData {
  title: string;
  form: SigaaForm;
  id: string;
}

/**
 * @category Public
 */
export class SigaaNews extends UpdatableResource<NewsData> {
  private _form!: SigaaForm;
  private _title!: string;
  private _content?: string;
  private _date?: Date;

  constructor(
    private http: HTTP,
    private parser: Parser,
    options: NewsData,
    updater: UpdatableResourceCallback
  ) {
    super(updater);
    this.update(options);
  }

  update(newsOptions: NewsData): void {
    this._title = newsOptions.title;
    this._form = newsOptions.form;
    this.isClosed = false;
  }

  get id(): string {
    this.checkIfItWasClosed();
    return this._form.postValues.id;
  }

  get title(): string {
    this.checkIfItWasClosed();
    return this._title;
  }

  async getContent(): Promise<string> {
    this.checkIfItWasClosed();
    if (this._content === undefined) {
      await this.getFullNews();
    }
    return this._content as string;
  }

  async getDate(): Promise<Date> {
    this.checkIfItWasClosed();
    if (this._date === undefined) {
      await this.getFullNews();
    }
    return this._date as Date;
  }

  private async getFullNews(retry = true): Promise<void> {
    try {
      const page = await this.http.post(
        this._form.action.href,
        this._form.postValues
      );
      if (page.statusCode !== 200) {
        throw new Error('SIGAA: Invalid status code at news page.');
      }
      const newsElement = page.$('ul.form');
      if (newsElement.length === 0) {
        throw new Error('SIGAA: Invalid news page.');
      }
      const els = newsElement.find('span');
      const dateString = this.parser.removeTagsHtml(els.eq(1).html());
      this._date = this.parser.parseDates(dateString, 1)[0];
      this._content = this.parser.removeTagsHtml(
        newsElement.find('div').html()
      );
    } catch (err) {
      if (retry) {
        await this.updateInstance();
        return this.getFullNews(false);
      } else {
        throw err;
      }
    }
  }
}
