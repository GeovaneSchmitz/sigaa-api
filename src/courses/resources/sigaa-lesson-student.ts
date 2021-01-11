import { Attachment } from '@courses/sigaa-course-student';
import {
  UpdatableResource,
  UpdatableResourceCallback
} from '@resources/updatable-resource';

/**
 * @category Internal
 */
export interface LessonData {
  title: string;
  contentText: string;
  startDate: Date;
  id: string;
  endDate: Date;
  attachments: Attachment[];
}

/**
 * @category Public
 */
export class SigaaLesson extends UpdatableResource<LessonData> {
  private _title!: string;
  private _contextText!: string;
  private _startDate!: Date;
  private _endDate!: Date;
  private _attachments!: Attachment[];

  constructor(options: LessonData, updater?: UpdatableResourceCallback) {
    super(updater);
    this.update(options);
  }

  update(options: LessonData): void {
    this._title = options.title;
    this._contextText = options.contentText;
    this._startDate = options.startDate;
    this._endDate = options.endDate;
    this._attachments = options.attachments;
    this.isClosed = false;
  }

  get title(): string {
    this.checkIfItWasClosed();
    return this._title;
  }

  get contentText(): string {
    this.checkIfItWasClosed();
    return this._contextText;
  }

  get endDate(): Date {
    this.checkIfItWasClosed();
    return this._endDate;
  }

  get startDate(): Date {
    this.checkIfItWasClosed();
    return this._startDate;
  }

  get attachments(): Attachment[] {
    this.checkIfItWasClosed();
    return this._attachments;
  }
}
