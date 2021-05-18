import { UpdatableResourceData } from '@resources/sigaa-resource-manager';
import {
  AbstractUpdatableResource,
  UpdatableResource,
  UpdatableResourceCallback
} from '@resources/updatable-resource';
import { HTTP } from '@session/sigaa-http';
import { SigaaForm } from '@session/sigaa-page';

/**
 * @category Internal
 */
export interface QuizData extends UpdatableResourceData {
  title: string;
  id: string;
  startDate: Date;
  endDate: Date;
  formSendAnswers?: SigaaForm;
  formViewAnswersSubmitted?: SigaaForm;
}

/**
 * @category Public
 */
export interface Quiz extends UpdatableResource<QuizData> {
  readonly title: string;
  readonly type: 'quiz';
  readonly endDate: Date;
  readonly startDate: Date;
  readonly id: string;
  /**
   * TODO
   * @param retry
   */
  getAnswersSubmitted(): Promise<void>;
}

/**
 * @category Internal
 */
export class SigaaQuiz extends AbstractUpdatableResource implements Quiz {
  readonly type = 'quiz';

  readonly errorDeadlineToReadClosed =
    'SIGAA: Deadline to read as answer closed.';
  readonly errorQuizYetNoSendAnswers = 'Sigaa: Quiz yet no sent answers.';

  private _formViewAnswersSubmitted?: SigaaForm;
  private _formSendAnswers?: SigaaForm;
  private _startDate!: Date;
  private _endDate!: Date;
  private _title!: string;
  private _id!: string;

  constructor(
    private http: HTTP,
    options: QuizData,
    updater: UpdatableResourceCallback
  ) {
    super(options.instanceIndentifier, updater);
    this.update(options);
  }

  update(options: QuizData): void {
    this._title = options.title;
    this._id = options.id;
    this._startDate = options.startDate;
    this._endDate = options.endDate;
    this._formSendAnswers = options.formSendAnswers;
    this._formViewAnswersSubmitted = options.formViewAnswersSubmitted;

    this.isClosed = false;
  }

  get title(): string {
    this.checkIfItWasClosed();
    return this._title;
  }

  get id(): string {
    this.checkIfItWasClosed();
    return this._id;
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
   * TODO
   * @param retry
   */
  async getAnswersSubmitted(retry = true): Promise<void> {
    try {
      if (this._formViewAnswersSubmitted === undefined)
        throw new Error('SIGAA: Quiz form is undefined.');

      const page = await this.http.post(
        this._formViewAnswersSubmitted.action.href,
        this._formViewAnswersSubmitted.postValues
      );

      switch (page.statusCode) {
        case 200:
          if (
            page.bodyDecoded.includes(
              'Acabou o prazo para visualizar as respostas.'
            )
          )
            throw new Error(this.errorDeadlineToReadClosed);
          if (
            page.bodyDecoded.includes(
              'Você ainda não enviou respostas para este questionário'
            )
          )
            throw new Error(this.errorQuizYetNoSendAnswers);
          break;
        case 302:
          throw new Error('SIGAA: Quiz expired.');
        default:
          throw new Error('SIGAA: Quiz page status code unexpected.');
      }
    } catch (err) {
      if (
        err.message === this.errorDeadlineToReadClosed ||
        err.message === this.errorQuizYetNoSendAnswers
      ) {
        throw err;
      }
      if (retry) {
        await this.updateInstance();
        this.getAnswersSubmitted(false);
      } else {
        throw err;
      }
    }
  }
}
