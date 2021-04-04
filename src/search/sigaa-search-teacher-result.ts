import { Parser } from '@helpers/sigaa-parser';
import { HTTP, ProgressCallback } from '@session/sigaa-http';
import { URL } from 'url';

/**
 * @category Internal
 */
export interface TeacherResultData {
  name: string;
  department: string;
  photoURL?: URL;
  pageURL: URL;
}

/**
 * @category Public
 */
export interface TeacherResult {
  readonly name: string;
  readonly department: string;
  readonly pageURL: URL;
  readonly profilePictureURL?: URL;
  /**
   * May return undefined if the teacher has no registered email
   */
  getEmail(): Promise<string | undefined>;
  /**
   * Download user profile picture, save in basepath
   * Returns the destination of the file on the file system
   * Throws an exception if the teacher does not have a photo
   * @param basepath path to save file
   * @param callback
   */
  downloadProfilePicture(
    basepath: string,
    callback: ProgressCallback
  ): Promise<string>;
}

/**
 * @category Internal
 */
export class SigaaSearchTeacherResult implements TeacherResult {
  private _name: string;
  private _department: string;
  private _pageURL: URL;
  private _photoURL?: URL;

  constructor(
    private http: HTTP,
    private parser: Parser,
    options: TeacherResultData
  ) {
    this._name = options.name;
    this._department = options.department;
    this._pageURL = options.pageURL;
    this._photoURL = options.photoURL;
  }

  async getEmail(): Promise<string | undefined> {
    const page = await this.http.get(this.pageURL.href);

    const contactElements = page.$('#contato').children().toArray();
    let email;
    for (const contactElement of contactElements) {
      const name = this.parser.removeTagsHtml(
        page.$(contactElement).find('dt').html()
      );
      if (name === 'Endereço eletrônico') {
        email = this.parser.removeTagsHtml(
          page.$(contactElement).find('dd').html()
        );
        break;
      }
    }
    if (email && email !== 'não informado') {
      return email;
    } else {
      return undefined;
    }
  }

  get name(): string {
    return this._name;
  }

  get profilePictureURL(): URL | undefined {
    return this._photoURL;
  }

  downloadProfilePicture(
    basepath: string,
    callback: ProgressCallback
  ): Promise<string> {
    if (!this.profilePictureURL)
      throw new Error("SIGAA: This teacher doesn't have profile picture");
    return this.http.downloadFileByGet(
      this.profilePictureURL.href,
      basepath,
      callback
    );
  }

  get department(): string {
    return this._department;
  }

  get pageURL(): URL {
    return this._pageURL;
  }
}
