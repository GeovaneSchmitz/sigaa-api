import { CourseForum } from '@courseResources/forum/sigaa-course-forum-student';
import { Homework } from '@attachments/sigaa-homework-student';
import { LinkAttachment } from '@attachments/sigaa-link-student';
import { Quiz } from '@attachments/sigaa-quiz-student';
import { Survey } from '@attachments/sigaa-survey-student';
import { VideoAttachment } from '@attachments/sigaa-video-student';
import { WebContent } from '@attachments/sigaa-web-content-student';
import { File } from '@resources/sigaa-file';
import { UpdatableResourceData } from '@resources/sigaa-resource-manager';
import {
  AbstractUpdatableResource,
  UpdatableResource,
  UpdatableResourceCallback
} from '@resources/updatable-resource';

/**
 * @category Public
 */
export type Attachment =
  | File
  | Homework
  | Quiz
  | CourseForum
  | WebContent
  | Survey
  | LinkAttachment
  | VideoAttachment;

/**
 * @category Internal
 */
export interface LessonData extends UpdatableResourceData {
  title: string;
  contentText: string;
  startDate: Date;
  endDate: Date;
  attachments: Attachment[];
}

/**
 * @category Public
 */
export interface Lesson extends UpdatableResource<LessonData> {
  readonly title: string;
  readonly contentText: string;
  readonly endDate: Date;
  readonly startDate: Date;
  readonly attachments: Attachment[];
}

/**
 * @category Internal
 */
export class SigaaLesson extends AbstractUpdatableResource implements Lesson {
  private _title!: string;
  private _contextText!: string;
  private _startDate!: Date;
  private _endDate!: Date;
  private _attachments!: Attachment[];

  constructor(options: LessonData, updater?: UpdatableResourceCallback) {
    super(options.instanceIndentifier, updater);
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
