import { Parser } from '@helpers/sigaa-parser';
import { HTTP, ProgressCallback } from '@session/sigaa-http';
import { Session } from '@session/sigaa-session';
import { LoginStatus } from '../sigaa-types';
import { URL } from 'url';
import { BondFactory, BondType } from '@bonds/sigaa-bond-factory';
import { Page } from '@session/sigaa-page';

/**
 * Abstraction of account type.
 *
 * Responsible for representing the user account.
 * @category Internal
 */
export interface Account {
  /**
   * get user's name
   */
  getName(): Promise<string>;

  /**
   * Returns active bonds, in IFSC it is called "Vínculos ativos".
   *
   * A user can have more than one bond.
   * Eg. A user takes two courses.
   */
  getActiveBonds(): Promise<BondType[]>;

  /**
   * Returns inactive bonds, in IFSC it is called "Vínculos inativos".
   * An inactive bond is a bond that the user has completed, for example, courses completed by the user.
   */
  getInactiveBonds(): Promise<BondType[]>;

  /**
   * Download profile url and save in basepath.
   * @param destpath It can be either a folder or a file name, if the path is a directory then it will be saved inside the folder, if it is a file name it will be saved exactly in this place, but if the folder does not exist it will throw an error.
   * @param callback To know the progress of the download, each downloaded part will be called informing how much has already been downloaded.
   * @retuns Full path of the downloaded file, useful if the destpath is a directory, or null if the user has no photo.
   */
  downloadProfilePicture(
    destpath: string,
    callback?: ProgressCallback
  ): Promise<string | null>;

  /**
   * Get profile picture URL
   * @retuns Picture url or null if the user has no photo.
   */
  getProfilePictureURL(): Promise<URL | null>;

  /**
   * Ends the session
   */
  logoff(): Promise<void>;

  /**
   * Change the password of account.
   * @param oldPassword current password.
   * @param newPassword new password.
   * @throws {errorInvalidCredentials} If current password is not correct.
   * @throws {errorInsufficientPasswordComplexity} If the new password does not have the complexity requirement.
   */
  changePassword(oldPassword: string, newPassword: string): Promise<void>;
}

/**
 * Responsible for representing the user account.
 * @category Public
 */
export class SigaaAccount implements Account {
  /**
   * @param homepage homepage (page after login) of user.
   */
  constructor(
    homepage: Page,
    private http: HTTP,
    private parser: Parser,
    private session: Session,
    private bondFactory: BondFactory
  ) {
    this.parseHomepage(homepage);
  }

  /**
   * Error message when the new password chosen does not meet the security requirements of SIGAA.
   * It is thrown by the changePassword() method
   */
  readonly errorInvalidCredentials = 'SIGAA: Invalid credentials.';

  /**
   * Error message when the old password is not the current password.
   * It is thrown by the changePassword() method.
   */
  readonly errorInsufficientPasswordComplexity =
    'SIGAA: Insufficent password complexity.';

  /**
   * Array of active bonds.
   */
  private activeBonds: BondType[] = [];

  /**
   * Array of inactive bonds.
   */
  private inactiveBonds: BondType[] = [];

  /**
   * It is a promise that stores if the page parser has already completed
   */
  private pagehomeParsePromise?: Promise<void>;

  /**
   * Parse login result page to fill the instance.
   *
   * @param homepage home page to parse.
   */
  private parseHomepage(homepage: Page): void {
    //As the login page can vary, we should check the type of page.

    if (homepage.url.href.includes('/portais/discente/discente.jsf')) {
      //If it is home page student of desktop version.
      this.pagehomeParsePromise = this.parseStudentHomePage(homepage);
    } else if (
      homepage.url.href.includes('/sigaa/vinculos.jsf') ||
      homepage.url.href.includes('/sigaa/escolhaVinculo.do')
    ) {
      //If it is bond page.
      this.pagehomeParsePromise = this.parseBondPage(homepage);
    }
  }

  /**
   * Parse bond page.
   * @param page page to parse.
   */
  private async parseBondPage(page: Page) {
    const rows = page.$('table.subFormulario tbody tr').toArray();
    for (const row of rows) {
      const cells = page.$(row).find('td').toArray();
      if (cells.length === 0) continue;

      const bondType = this.parser.removeTagsHtml(
        page.$(row).find('#tdTipo').html()
      );
      const status = this.parser.removeTagsHtml(page.$(cells[3]).html());
      let bond;
      switch (bondType) {
        case 'Discente': {
          const registration = this.parser.removeTagsHtml(
            page.$(cells[2]).html()
          );

          const url = page.$(row).find('a[href]').attr('href');
          if (!url)
            throw new Error('SIGAA: Bond switch url could not be found.');
          const bondSwitchUrl = new URL(url, page.url);

          const program = this.parser
            .removeTagsHtml(page.$(cells[4]).html())
            .replace(/^Curso: /g, '');
          bond = this.bondFactory.createStudentBond(
            registration,
            program,
            bondSwitchUrl
          );
          if (status === 'Sim') {
            this.activeBonds.push(bond);
          } else {
            this.inactiveBonds.push(bond);
          }
          break;
        }
        case 'Docente': {
          bond = this.bondFactory.createTeacherBond();
          break;
        }
      }
      if (bond)
        if (status === 'Sim') {
          this.activeBonds.push(bond);
        } else if (status === 'Não') {
          this.inactiveBonds.push(bond);
        } else {
          console.log('SIGAA: WARNING invalid status: ' + status);
        }
    }
  }

  /**
   * @inheritdoc
   */
  async getActiveBonds(): Promise<BondType[]> {
    await this.pagehomeParsePromise;
    return this.activeBonds;
  }

  /**
   * @inheritdoc
   */
  async getInactiveBonds(): Promise<BondType[]> {
    await this.pagehomeParsePromise;
    return this.inactiveBonds;
  }

  /**
   * Parse desktop version of student home page page.
   */
  private async parseStudentHomePage(homepage: Page) {
    const rows = homepage.$('#perfil-docente table').eq(0).find('tr').toArray();
    let registration;
    let program;
    let status;

    const buttonSwitchBond = this.parser.removeTagsHtml(
      homepage.$('#info-usuario p i small a').html()
    );
    if (buttonSwitchBond === 'Alterar vínculo') {
      const bondPage = await this.http.get('/sigaa/vinculos.jsf');
      return this.parseBondPage(bondPage);
    }

    for (const row of rows) {
      const cells = homepage.$(row).find('td');
      if (cells.length !== 2) {
        throw new Error('SIGAA: Invalid student details page.');
      }
      const rowName = this.parser.removeTagsHtml(cells.eq(0).html());
      switch (rowName) {
        case 'Matrícula:':
          registration = this.parser.removeTagsHtml(cells.eq(1).html());
          break;
        case 'Curso:':
          program = this.parser
            .removeTagsHtml(cells.eq(1).html())
            .replace(/ - (M|T|N)$/g, ''); // Remove schedule letter
          break;
        case 'Status:':
          status = this.parser.removeTagsHtml(cells.eq(1).html());
      }
      if (registration && program && status) break;
    }

    if (!registration)
      throw new Error('SIGAA: Student bond with registration code.');

    if (!program) throw new Error('SIGAA: Student bond program not found.');

    if (!status) throw new Error('SIGAA: Student bond status not found.');
    if (status === 'CURSANDO')
      this.activeBonds.push(
        this.bondFactory.createStudentBond(registration, program, null)
      );
    else
      this.inactiveBonds.push(
        this.bondFactory.createStudentBond(registration, program, null)
      );
  }

  /**
   * @inheritdoc
   */
  logoff(): Promise<void> {
    return this.http
      .get('/sigaa/logar.do?dispatch=logOff')
      .then((page) => {
        return this.http.followAllRedirect(page);
      })
      .then((page) => {
        if (page.statusCode !== 200) {
          throw new Error('SIGAA: Invalid status code in logoff page.');
        }
        this.session.loginStatus = LoginStatus.Unauthenticated;
        this.http.closeSession();
      });
  }

  /**
   * Get profile picture URL.
   * @retuns Picture url or null if the user has no photo.
   */
  async getProfilePictureURL(): Promise<URL | null> {
    const page = await this.http.get('/sigaa/mobile/touch/menu.jsf');

    const pictureElement = page.$('div[data-role="fieldcontain"] img');
    if (pictureElement.length === 0) return null;
    const pictureSrc = pictureElement.attr('src');
    if (!pictureSrc || pictureSrc.includes('/img/avatar.jpg')) return null;

    return new URL(pictureSrc, page.url);
  }

  /**
   * Download profile url and save in basepath.
   * @param destpath It can be a folder or a file name, if it is a directory then it will be saved inside the folder, if it is a file name it will be saved exactly in this place, but if the folder does not exist it will throw an error.
   * @param callback To know the progress of the download, each downloaded part will be called informing how much has already been downloaded.
   * @retuns Full path of the downloaded file, useful if the destpath is a directory, or null if the user has no photo.
   */
  async downloadProfilePicture(
    destpath: string,
    callback?: ProgressCallback
  ): Promise<string | null> {
    const pictureURL = await this.getProfilePictureURL();
    if (!pictureURL) return null;
    return this.http.downloadFileByGet(pictureURL.href, destpath, callback);
  }

  /**
   * Returns a promise with user name.
   */
  async getName(): Promise<string> {
    const page = await this.http.get('/sigaa/portais/discente/discente.jsf');
    if (page.statusCode === 200) {
      const username = this.parser.removeTagsHtml(
        page.$('p.usuario > span').html()
      );
      return username;
    } else {
      throw new Error('SIGAA: Unexpected status code at student profile page.');
    }
  }

  /**
   * Change the password of account.
   * @param oldPassword current password.
   * @param newPassword new password.
   * @throws {errorInvalidCredentials} If current password is not correct.
   * @throws {errorInsufficientPasswordComplexity} If the new password does not have the complexity requirement.
   */
  async changePassword(
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    const formPage = await this.http.get('/sigaa/alterar_dados.jsf');
    if (formPage.statusCode !== 302)
      throw new Error('SIGAA: Unexpected status code at change password form.');

    const prePage = await this.http.followAllRedirect(formPage);
    if (
      prePage.statusCode !== 200 ||
      !prePage.url.href.includes('usuario/alterar_dados.jsf')
    )
      throw new Error('SIGAA: Invalid pre page at change password.');

    const preFormElement = prePage.$('form[name="form"]');

    const preAction = preFormElement.attr('action');
    if (!preAction)
      throw new Error(
        'SIGAA: Form without action at change password pre page.'
      );

    const preActionUrl = new URL(preAction, prePage.url.href);

    const prePostValues: Record<string, string> = {};

    const preInputs = preFormElement
      .find("input[name]:not([type='submit'])")
      .toArray();
    for (const input of preInputs) {
      const name = prePage.$(input).attr('name');
      if (name) {
        prePostValues[name] = prePage.$(input).val();
      }
    }
    prePostValues['form:alterarSenha'] = 'form:alterarSenha';
    const page = await this.http.post(preActionUrl.href, prePostValues);
    const formElement = page.$('form[name="form"]');

    const action = formElement.attr('action');
    if (!action)
      throw new Error('SIGAA: Form without action at change password page.');
    const formAction = new URL(action, page.url.href);

    const postValues: Record<string, string> = {};
    const inputs = formElement
      .find("input[name]:not([type='submit'])")
      .toArray();
    for (const input of inputs) {
      const name = page.$(input).attr('name');
      if (name) {
        postValues[name] = prePage.$(input).val();
      }
    }

    postValues['form:senhaAtual'] = oldPassword;
    postValues['form:novaSenha'] = newPassword;
    postValues['form:repetnNovaSenha'] = newPassword;
    postValues['form:alterarDados'] = 'Alterar Dados';

    const resultPage = await this.http.post(formAction.href, postValues);

    if (resultPage.statusCode === 200) {
      const errorMsg = this.parser.removeTagsHtml(
        resultPage.$('.erros li').html()
      );
      if (errorMsg.includes('A senha digitada é muito simples.')) {
        throw new Error(this.errorInsufficientPasswordComplexity);
      }
      if (errorMsg.includes('Senha Atual digitada não confere')) {
        throw new Error(this.errorInvalidCredentials);
      }
    }

    if (resultPage.statusCode !== 302) {
      throw new Error(
        'SIGAA: The change password page status code is different than expected.'
      );
    }
  }
}
