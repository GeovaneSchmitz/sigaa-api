import { HTTP, ProgressCallback } from '@session/sigaa-http';
import { SigaaForm } from '@session/sigaa-page';
import {
  AbstractUpdatableResource,
  UpdatableResource,
  UpdatableResourceCallback
} from './updatable-resource';

/**
 * @category Internal
 */
interface FileDataKey {
  id: string;
  key: string;
  title: string;
  description: string;
}

/**
 * @category Internal
 */
interface FileDataForm {
  form: SigaaForm;
  id: string;
  title: string;
  description: string;
}

/**
 * @category Internal
 */
export type FileData = FileDataForm | FileDataKey;

/**
 * @category Public
 */
export interface File extends UpdatableResource<FileData> {
  readonly type: 'file';
  /**
   * Label in SIGAA.
   */
  readonly title?: string;
  /**
   * Is a key to download a file, this is a security feature of SIGAA.
   */
  readonly key?: string;
  /**
   *Description in the sigaa
   */
  readonly description?: string;
  /**
   * Download the file
   * @param destpath path to save file
   * @param callback callback to view download progress
   * @retuns Promise with the path where the file was saved.
   */
  download(destpath: string, callback?: ProgressCallback): Promise<string>;
}

/**
 * Class to manager file
 * @category Internal
 */
export class SigaaFile extends AbstractUpdatableResource implements File {
  /**
   * There are two ways to create the class
   * the first is used the file's id and key
   * the second is used the file form
   *
   * @param options
   * @param sigaaSession
   */
  constructor(
    private http: HTTP,
    options: FileData,
    updater?: UpdatableResourceCallback
  ) {
    super(updater);
    this.update(options);
  }

  readonly type = 'file';

  private form?: SigaaForm;

  private _title?: string;
  private _key?: string;
  private _description?: string;

  update(options: FileData): void {
    this._title = options.title;
    this._description = options.description;

    if ((options as FileDataForm).form !== undefined) {
      this.form = (options as FileDataForm).form;
      this._id = this.form.postValues.id;
      this._key = this.form.postValues.key;
    } else if (
      (options as FileDataKey).id !== undefined &&
      (options as FileDataKey).key !== undefined
    ) {
      this._id = (options as FileDataKey).id;
      this._key = (options as FileDataKey).key;
    } else {
      throw new Error('SIGAA: Invalid FileData.');
    }
    this.isClosed = false;
  }

  get title(): string | undefined {
    this.checkIfItWasClosed();
    return this._title;
  }

  get key(): string | undefined {
    this.checkIfItWasClosed();
    return this._key;
  }

  get description(): string | undefined {
    this.checkIfItWasClosed();
    return this._description;
  }

  get id(): string {
    this.checkIfItWasClosed();
    return this._id;
  }

  async download(
    basepath: string,
    callback?: ProgressCallback,
    retry = true
  ): Promise<string> {
    this.checkIfItWasClosed();
    if (this.form) {
      return this.http
        .downloadFileByPost(
          this.form.action.href,
          this.form.postValues,
          basepath,
          callback
        )
        .catch(async (err) => {
          this.form = undefined;
          await this.updateInstance();
          if (retry) return this.download(basepath, callback, false);
          else throw err;
        });
    } else if (this.key != null) {
      const fileDownloadPath = `/sigaa/verFoto?idArquivo=${this.id}&key=${this.key}`;
      return this.http
        .downloadFileByGet(fileDownloadPath, basepath, callback)
        .catch((err) => {
          if (retry) return this.download(basepath, callback, false);
          else throw err;
        });
    }
    throw new Error(
      'SIGAA: Could not download the file because the key is missing.'
    );
  }
}
