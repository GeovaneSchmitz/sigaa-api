import { URL } from 'url';
import { FileData } from '@resources/sigaa-file';
import { HTTP } from '@session/sigaa-http';
import { SigaaForm } from '@session/sigaa-page';
import { File } from '@resources/sigaa-file';
import { CourseResourcesFactory } from '@courses/sigaa-course-resources-factory';

import {
  AbstractUpdatableResource,
  UpdatableResource,
  UpdatableResourceCallback
} from '@resources/updatable-resource';
import { UpdatableResourceData } from '@resources/sigaa-resource-manager';

/**
 * @category Internal
 */
export interface HomeworkData extends UpdatableResourceData {
  title: string;
  startDate: Date;
  endDate: Date;
  id?: string;
  description?: string;
  haveGrade?: boolean;
  isGroupHomework?: boolean;
  formSendHomework?: SigaaForm;
  formViewHomeworkSubmitted?: SigaaForm;
}

/**
 * @category Internal
 */
export interface Homework extends UpdatableResource<HomeworkData> {
  readonly type: 'homework';
  readonly title: string;
  getFlagHaveGrade(): Promise<boolean>;
  getFlagIsGroupHomework(): Promise<boolean>;

  readonly startDate: Date;
  readonly endDate: Date;
  /**
   * Get attachment file.
   */
  getAttachmentFile(): Promise<File>;
}

/**
 * @category Internal
 */
export class SigaaHomework
  extends AbstractUpdatableResource
  implements Homework {
  readonly type = 'homework';

  private _title!: string;
  private _startDate!: Date;
  private _endDate!: Date;
  private _id?: string;
  private _formSendHomework?: SigaaForm;
  private _formViewHomeworkSubmitted?: SigaaForm;
  private _description?: string;
  private _haveGrade?: boolean;
  private _isGroupHomework?: boolean;
  private _file?: File;

  constructor(
    private http: HTTP,
    private courseResourcesFactory: CourseResourcesFactory,
    options: HomeworkData,
    updater: UpdatableResourceCallback
  ) {
    super(options.instanceIndentifier, updater);
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
    this._isGroupHomework = options.isGroupHomework;

    this.isClosed = false;
  }

  get title(): string {
    this.checkIfItWasClosed();
    return this._title;
  }

  get id(): string | null {
    this.checkIfItWasClosed();
    return this._id || null;
  }

  async getFlagHaveGrade(): Promise<boolean> {
    if (this._haveGrade === undefined) {
      await this.updateInstance();
    }
    this.checkIfItWasClosed();
    if (this._haveGrade === undefined)
      throw new Error('SIGAA: Homework have grade could not be loaded.');

    return this._haveGrade;
  }

  async getFlagIsGroupHomework(): Promise<boolean> {
    if (this._isGroupHomework === undefined) {
      await this.updateInstance();
    }
    this.checkIfItWasClosed();

    if (this._isGroupHomework === undefined)
      throw new Error('SIGAA: Homework group flag could not be loaded.');

    return this._isGroupHomework;
  }

  async getDescription(): Promise<string> {
    if (!this._description) {
      await this.updateInstance();
    }
    this.checkIfItWasClosed();
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
   * @inheritdoc
   */
  async getAttachmentFile(): Promise<File> {
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
      id: fileId,
      instanceIndentifier: fileId
    };

    if (!this._file) {
      this._file = this.courseResourcesFactory.createFileFromFileData(
        this.http,
        file,
        async () => {
          throw new Error('SIGAA: Invalid file in Homework.');
        }
      );
    } else {
      this._file.update(file);
    }
    return this._file;
  }
}
