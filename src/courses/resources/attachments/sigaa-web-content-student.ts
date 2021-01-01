import { Parser } from '@helpers/sigaa-parser';
import {
  UpdatableResource,
  UpdatableResourceCallback
} from '@resources/updatable-resource';
import { HTTP } from '@session/sigaa-http';
import { SigaaForm } from '@session/sigaa-page';

export interface WebContentData {
  title: string;
  id: string;
  form: SigaaForm;
  date?: Date;
}

export class SigaaWebContent extends UpdatableResource<WebContentData> {
  readonly type = 'webcontent';

  private _title!: string;
  private form!: SigaaForm;
  private _content!: string;
  private _date!: Date;

  constructor(
    private http: HTTP,
    private parser: Parser,
    options: WebContentData,
    updater: UpdatableResourceCallback
  ) {
    super(updater);
    this.update(options);
  }

  update(options: WebContentData): void {
    this._title = options.title;
    if (options.date) this._date = options.date;
    this.form = options.form;
    this.isClosed = false;
  }

  async getDate(): Promise<Date> {
    if (!this._date) {
      await this.loadWebContentPage();
    }
    return this._date;
  }

  get title(): string {
    this.checkIfItWasClosed();
    return this._title;
  }

  async getContent(): Promise<string> {
    if (!this._content) {
      await this.loadWebContentPage();
    }
    return this._content;
  }

  private async loadWebContentPage(retry = true): Promise<void> {
    this.checkIfItWasClosed();
    try {
      const page = await this.http.post(
        this.form.action.href,
        this.form.postValues
      );
      if (page.statusCode === 200) {
        const rows = page.$('table.formAva tr').toArray();
        for (const row of rows) {
          const rowLabel = this.parser.removeTagsHtml(
            page.$(row).find('th').html()
          );
          const rowContent = this.parser.removeTagsHtml(
            page.$(row).find('td').html()
          );
          switch (rowLabel) {
            case 'Título:': {
              this._title = rowContent;
              break;
            }
            case 'Conteúdo:': {
              this._content = rowContent;
              break;
            }
            case 'Data Cadastro:': {
              const date = this.parser.parseDates(rowContent, 1);

              this._date = date[0];

              break;
            }
          }
        }
      } else if (page.statusCode === 302) {
        throw new Error('SIGAA: Webcontent expired.');
      } else {
        throw new Error('SIGAA: Unexpected webcontent page status code.');
      }
    } catch (err) {
      if (retry) {
        await this.updateInstance();
        return this.loadWebContentPage(false);
      } else {
        throw err;
      }
    }
  }

  get id(): string {
    this.checkIfItWasClosed();
    return this.form.postValues.id;
  }
}
