import {
  UpdatableResource,
  UpdatableResourceCallback
} from '@resources/updatable-resource';
import { SigaaForm } from '@session/sigaa-page';

export interface SurveyData {
  title: string;
  form: SigaaForm;
}

export class SigaaSurvey extends UpdatableResource<SurveyData> {
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
