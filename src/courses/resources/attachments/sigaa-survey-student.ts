import {
  AbstractUpdatableResource,
  UpdatableResource,
  UpdatableResourceCallback
} from '@resources/updatable-resource';
import { SigaaForm } from '@session/sigaa-page';

/**
 * @category Internal
 */
export interface SurveyData {
  id: string;
  title: string;
  form: SigaaForm;
}

/**
 * @category Public
 */
export interface Survey extends UpdatableResource<SurveyData> {
  readonly type: 'survey';
  readonly title: string;
}

/**
 * @category Internal
 */
export class SigaaSurvey extends AbstractUpdatableResource implements Survey {
  readonly type = 'survey';

  private _title!: string;
  private _form!: SigaaForm;

  constructor(options: SurveyData, updater: UpdatableResourceCallback) {
    super(updater);
    this.update(options);
  }

  update(options: SurveyData): void {
    this._title = options.title;
    this._form = options.form;
    this.isClosed = false;
  }

  get title(): string {
    this.checkIfItWasClosed();
    return this._title;
  }

  get id(): string {
    this.checkIfItWasClosed();
    return this._form.postValues.id;
  }
}
