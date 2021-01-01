import { URL } from 'url';

import FormData from 'formdata-node';
import { Parser } from '@helpers/sigaa-parser';
import { SigaaFile, FileData } from '@resources/sigaa-file';
import {
  UpdatableResource,
  UpdatableResourceCallback
} from '@resources/updatable-resource';
import { HTTP } from '@session/sigaa-http';
import { SigaaForm, Page } from '@session/sigaa-page';

export interface ForumData {
  title: string;
  id: string;
  form: SigaaForm;
  isMain: boolean;
  creationDate?: Date;
  forumType?: string;
  author?: string;
  numOfTopics?: number;
}

export class SigaaCourseForum extends UpdatableResource<ForumData> {
  readonly type = 'forum';

  private _isMain!: boolean;
  private _form!: SigaaForm;
  private _title!: string;
  private _numOfTopics?: number;
  private _author?: string;
  private _forumType?: string;
  private _description?: string;
  private _submitTopicPageForm?: SigaaForm;
  private _file?: SigaaFile;
  private _monitorReading?: boolean;
  private _fullForumPromise: Promise<void> | null = null;
  private _creationDate?: Date;

  constructor(
    private http: HTTP,
    private parser: Parser,
    forumOptions: ForumData,
    updater: UpdatableResourceCallback
  ) {
    super(updater);
    this.update(forumOptions);
  }

  update(forumOptions: ForumData): void {
    this._title = forumOptions.title;
    this._form = forumOptions.form;
    this._id = forumOptions.id;
    this._isMain = forumOptions.isMain;

    if (forumOptions.forumType !== undefined) {
      this._forumType = forumOptions.forumType;
    }
    if (forumOptions.numOfTopics !== undefined) {
      this._numOfTopics = forumOptions.numOfTopics;
    }
    if (forumOptions.author !== undefined) {
      this._author = forumOptions.author;
    }
  }

  /**
   * If is first page
   */
  get isMain(): boolean {
    return this._isMain;
  }

  private async loadForumPage() {
    if (!this._fullForumPromise) {
      this._fullForumPromise = this.getForumPage();
      this._fullForumPromise.finally(() => {
        this._fullForumPromise = null;
      });
    }
    return this._fullForumPromise;
  }

  get title(): string {
    this.checkIfItWasClosed();
    return this._title;
  }

  /**
   * Like 'Uma única discussão simples'
   */
  async getForumType(): Promise<string> {
    this.checkIfItWasClosed();
    if (this._forumType === undefined) {
      await this.loadForumPage();
    }
    if (!this._forumType)
      throw new Error('SIGAA: Forum type could not be loaded.');
    return this._forumType;
  }

  async getDescription(): Promise<string> {
    this.checkIfItWasClosed();
    if (this._description === undefined) {
      await this.loadForumPage();
    }
    if (!this._description)
      throw new Error('SIGAA: Forum description could not be loaded.');
    return this._description;
  }

  /**
   * Post author
   */
  async getAuthor(): Promise<string> {
    this.checkIfItWasClosed();
    if (this._author === undefined) {
      await this.loadForumPage();
    }
    if (!this._author)
      throw new Error('SIGAA: Forum author could not be loaded.');
    return this._author;
  }

  async getFile(): Promise<SigaaFile | undefined> {
    this.checkIfItWasClosed();
    if (this._file === undefined) {
      await this.loadForumPage();
    }
    return this._file;
  }

  async getNumOfTopics(): Promise<number> {
    this.checkIfItWasClosed();
    if (this._numOfTopics === undefined) {
      await this.updateInstance();
    }
    if (!this._numOfTopics)
      throw new Error('SIGAA: Forum number of topics could not be loaded.');
    return this._numOfTopics;
  }
  /**
   * Post topic in forum
   * @param title title of topic
   * @param body body of topic
   * @param file buffer of file attachment
   * @param notify if notify members
   */
  async postTopic(
    title: string,
    body: string,
    file: string,
    notify: boolean
  ): Promise<void> {
    if (!title) {
      throw new Error('SIGAA: title topic forum cannot be empty.');
    }
    if (!body) {
      throw new Error('SIGAA: title body forum cannot be empty.');
    }
    if (!this._submitTopicPageForm) {
      await this.loadForumPage();
    }
    if (!this._submitTopicPageForm)
      throw new Error('SIGAA: Could not get the forum form.');
    const page = await this.http.post(
      this._submitTopicPageForm.action.href,
      this._submitTopicPageForm.postValues
    );

    const formElement = page.$('form#form');
    const action = formElement.attr('action');
    if (!action)
      throw new Error('SIGAA: Forum post page has form without action.');
    const actionURl = new URL(action, page.url.href);

    const inputHiddens = formElement
      .find('form#form input[type="hidden"]')
      .toArray();
    const fileInput = formElement.find('input[type="file"]');
    const submitButton = formElement.find('input[name="form:btnSalvar"]');
    const notifyCheckbox = formElement.find('input[type="checkbox"]');
    if (
      inputHiddens.length === 0 ||
      submitButton.length !== 1 ||
      notifyCheckbox.length !== 1 ||
      fileInput.length !== 1
    )
      throw new Error(
        'SIGAA: Forum post page format is different than expected.'
      );

    const formData = new FormData();
    for (const input of inputHiddens) {
      const name = page.$(input).attr('name');
      if (name) formData.set(name, page.$(input).val());
    }
    if (file) {
      const name = fileInput.attr('name');
      if (!name)
        throw new Error('SIGAA: Forum post page has input file without name.');
      formData.set(name, file);
    }
    if (notify) {
      const name = notifyCheckbox.attr('name');
      if (!name)
        throw new Error(
          'SIGAA: Forum post page has notify checkbox without name.'
        );
      formData.set(name, 'on');
    }
    formData.set('form:assunto', title);
    formData.set('form:mensagem', body);
    const sumbitName = page.$(submitButton).attr('name');
    if (!sumbitName)
      throw new Error('SIGAA: Forum post page has submit button without name.');

    formData.set(sumbitName, page.$(submitButton).val());
    const responsePage = await this.http.postMultipart(
      actionURl.href,
      formData
    );
    if (!responsePage.body.includes('Operação realizada com sucesso!')) {
      throw new Error('SIGAA: Unexpected response forum post page.');
    }
  }

  async getCreationDate(): Promise<Date> {
    this.checkIfItWasClosed();
    if (this._creationDate === undefined) {
      await this.loadForumPage();
    }
    if (!this._creationDate)
      throw new Error('SIGAA: forum creation date could not be loaded.');
    return this._creationDate;
  }

  async getMonitorReading(): Promise<boolean> {
    this.checkIfItWasClosed();
    if (this._monitorReading === undefined) {
      await this.loadForumPage();
    }
    if (this._monitorReading !== false && this._monitorReading !== true)
      throw new Error('SIGAA: forum monitor reading could not be loaded.');
    return this._monitorReading;
  }

  private async getForumPage(retry = true): Promise<void> {
    try {
      const page = await this.http.post(
        this._form.action.href,
        this._form.postValues
      );

      this.parseForumTable(page);
      this.parseSubmitPageForm(page);
    } catch (err) {
      if (retry) {
        await this.updateInstance();
        return this.getForumPage(false);
      } else {
        throw err;
      }
    }
  }

  private parseSubmitPageForm(page: Page): void {
    const formElement = page.$('form#form');
    const action = formElement.attr('action');
    if (!action)
      throw new Error('SIGAA: Forum submit page has form without action.');
    const actionURL = new URL(action, page.url.href);
    const postValues: Record<string, string> = {};
    formElement
      .find("input:not([type='button'])")
      .each((index: number, element: cheerio.Element) => {
        const name = page.$(element).attr('name');
        if (name) postValues[name] = page.$(element).val();
      });

    this._submitTopicPageForm = {
      action: actionURL,
      postValues
    };
  }

  private parseForumTable(page: Page): void {
    const tableElement = page.$('table.formAva > tbody');
    if (tableElement.length === 0)
      throw new Error('SIGAA: Unexpected forum page without table element.');

    const rows = tableElement.find('tr').toArray();
    for (const row of rows) {
      const headCellElement = page.$(row).find('th');
      const dataCellElement = page.$(row).find('td');
      const label = this.parser.removeTagsHtml(headCellElement.html());
      const content = this.parser.removeTagsHtml(dataCellElement.html());
      switch (label) {
        case 'Título:': {
          this._title = content;
          break;
        }
        case 'Descrição:': {
          this._description = content;
          break;
        }
        case 'Autor(a):': {
          this._author = content;
          break;
        }
        case 'Arquivo:': {
          const linkElement = page.$(dataCellElement).find('a');
          if (linkElement.length === 1) {
            const title = this.parser.removeTagsHtml(linkElement.html());
            const onClick = linkElement.attr('onclick');
            if (!onClick)
              throw new Error('SIGAA: Invalid file format at forum page.');
            const form = page.parseJSFCLJS(onClick);
            const fileObj: FileData = {
              title,
              description: '',
              form,
              id: form.postValues.id
            };
            if (this._file) {
              this._file.update(fileObj);
            } else {
              this._file = new SigaaFile(
                this.http,
                fileObj,
                this.getForumPage.bind(this)
              );
            }
          } else {
            this._file = undefined;
          }
          break;
        }
        case 'Monitorar Leitura:': {
          if (content === 'SIM') {
            this._monitorReading = true;
          } else {
            this._monitorReading = false;
          }
          break;
        }
        case 'Tipo:': {
          this._forumType = content;
          break;
        }
        case 'Ordenação Padrão:': {
          //TODO
          break;
        }
        case 'Criado em:': {
          const dates = this.parser.parseDates(content, 1);
          this._creationDate = dates[0];
          break;
        }
        default: {
          console.log('WARNING:forum label not recognized:' + label);
        }
      }
    }
  }
}
