import { URL } from 'url';

import { SigaaFile, FileData } from '@resources/sigaa-file';
import {
  UpdatableResource,
  UpdatableResourceCallback
} from '@resources/updatable-resource';
import { HTTP } from '@session/sigaa-http';
import { SigaaForm } from '@session/sigaa-page';

/**
 * @category Internal
 */
export interface HomeworkData {
  title: string;
  startDate: Date;
  endDate: Date;
  id: string;
  description?: string;
  haveGrade?: boolean;
  formSendHomework?: SigaaForm;
  formViewHomeworkSubmitted?: SigaaForm;
}

/**
 * @category Public
 */
export class SigaaHomework extends UpdatableResource<HomeworkData> {
  readonly type = 'homework';

  private _title!: string;
  private _startDate!: Date;
  private _endDate!: Date;
  private _formSendHomework?: SigaaForm;
  private _formViewHomeworkSubmitted?: SigaaForm;
  private _description?: string;
  private _haveGrade?: boolean;
  private _file?: SigaaFile;

  constructor(
    private http: HTTP,
    options: HomeworkData,
    updater: UpdatableResourceCallback
  ) {
    super(updater);
    this.update(options);
  }

  update(options: HomeworkData): void {
    this._title = options.title;
    this._startDate = options.startDate;
    this._endDate = options.endDate;
    this._id = options.id;

    this._formSendHomework = options.formSendHomework;
    this._formViewHomeworkSubmitted = options.formViewHomeworkSubmitted;
    this._description = options.description;
    this._haveGrade = options.haveGrade;

    this.isClosed = false;
  }

  get title(): string {
    this.checkIfItWasClosed();
    return this._title;
  }

  async getHaveGrade(): Promise<boolean> {
    if (this._haveGrade === undefined) {
      await this.updateInstance();
    }
    if (this._haveGrade === undefined)
      throw new Error('SIGAA: Homework have grade could not be loaded.');

    return this._haveGrade;
  }

  async getDescription(): Promise<string> {
    if (!this._description) {
      await this.updateInstance();
    }
    if (!this._description)
      throw new Error('SIGAA: Homework description could not be loaded.');
    return this._description;
  }

  get endDate(): Date {
    this.checkIfItWasClosed();
    return this._endDate;
  }

  get startDate(): Date {
    this.checkIfItWasClosed();
    return this._startDate;
  }

  /**
   * Get SigaaFile or throws if you don't have a file
   * @returns
   */
  async getAttachmentFile(): Promise<SigaaFile> {
    if (
      this._formSendHomework === undefined &&
      this._formViewHomeworkSubmitted === undefined
    )
      await this.updateInstance();
    if (!this._formSendHomework)
      throw new Error('SIGAA: Homework has been submitted.');
    const page = await this.http.post(
      this._formSendHomework.action.href,
      this._formSendHomework.postValues
    );

    const path = page.$('ul.form > li > div > a').attr('href');
    if (!path) throw new Error('SIGAA: Homework has no file.');
    const url = new URL(path, page.url);
    const fileKey = url.searchParams.get('key');
    const fileId = url.searchParams.get('idArquivo');
    if (fileId == null || fileKey == null)
      throw new Error('SIGAA: File URL is invalid.');

    const file: FileData = {
      title: '',
      description: '',
      key: fileKey,
      id: fileId
    };

    if (!this._file) {
      this._file = new SigaaFile(this.http, file);
    } else {
      this._file.update(file);
    }
    return this._file;
  }
}
