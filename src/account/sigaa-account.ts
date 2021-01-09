import { Parser } from '@helpers/sigaa-parser';
import { HTTP, ProgressCallback } from '@session/sigaa-http';
import { Session } from '@session/sigaa-session';
import { LoginStatus } from '../sigaa-types';
import { URL } from 'url';
import { BondFactory, BondType } from '@bonds/sigaa-bond-factory';
import { Page } from '@sigaa';

export interface Account {
  /**
   * get user's name
   */
  getName(): Promise<string>;

  /**
   * Returns all bonds
   */
  getBonds(): Promise<BondType[]>;

  /**
   * Download user profile picture, save in filepath
   * File path can be a directory
   * @param basepath Path to save the image
   * @returns Full filepath of image
   */
  downloadProfilePicture(
    basepath: string,
    callback?: ProgressCallback
  ): Promise<string>;
  /**
   * Get profile picture URL
   * @returns URL of profile picture
   */
  getProfilePictureURL(): Promise<URL>;
  /**
   * Ends the session
   */
  logoff(): Promise<void>;
}

export class SigaaAccount {
  /**
   * userType
   */
  readonly errorInvalidCredentials = 'SIGAA: Invalid credentials.';
  readonly errorInsufficientPasswordComplexity =
    'SIGAA: Insufficent password complexity.';

  private bonds: BondType[] = [];
  constructor(
    loginPage: Page,
    private http: HTTP,
    private parser: Parser,
    private session: Session,
    private bondFactory: BondFactory
  ) {
    this.parseLoginPage(loginPage);
  }

  private parseLoginPage(loginResultPage: Page): void {
    if (loginResultPage.url.href.includes('mobile')) {
      if (loginResultPage.body.includes('form-portal-discente')) {
        this.parseStudentHomeMobilePage(loginResultPage);
      } else if (loginResultPage.body.includes('form-portal-docente')) {
        this.bonds.push(this.bondFactory.createTeacherBond());
      }
    } else if (
      loginResultPage.url.href.includes('/portais/discente/discente.jsf')
    ) {
      this.parseStudentHomePage(loginResultPage);
    } else if (
      loginResultPage.url.href.includes('sigaa/vinculos.jsf') ||
      loginResultPage.url.href.includes('/sigaa/escolhaVinculo.do')
    ) {
      this.parseBondPage(loginResultPage);
    }
  }

  private parseStudentHomeMobilePage(page: Page) {
    const registration = this.parser.removeTagsHtml(
      page.$('#form-portal-discente\\:matricula').html()
    );
    const homePageDescription = this.parser
      .removeTagsHtml(page.$('div[data-role="fieldcontain"] > small').html())
      .split('\n');
    const program = homePageDescription[homePageDescription.length - 1];
    this.bonds.push(
      this.bondFactory.createStudentBond(registration, program, null)
    );
  }

  private parseBondPage(page: Page) {
    const rows = page.$('table.subFormulario tbody tr').toArray();
    for (const row of rows) {
      const cells = page.$(row).find('td').toArray();
      if (cells.length === 0) continue;

      const bondType = this.parser.removeTagsHtml(
        page.$(row).find('#tdTipo').html()
      );
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

          this.bonds.push(
            this.bondFactory.createStudentBond(
              registration,
              program,
              bondSwitchUrl
            )
          );
          break;
        }
        case 'Docente': {
          this.bonds.push(this.bondFactory.createTeacherBond());
          break;
        }
      }
    }
  }

  private parseStudentHomePage(loginPage: Page) {
    const rows = loginPage
      .$('#perfil-docente table')
      .eq(0)
      .find('tr')
      .toArray();
    let registration;
    let program;
    for (const row of rows) {
      const cells = loginPage.$(row).find('td');
      if (cells.length !== 2) {
        throw new Error('SIGAA: Invalid student details page');
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
      }
      if (registration && program) break;
    }

    if (!registration)
      throw new Error('SIGAA: Student bond with registration code');

    if (!program) throw new Error('SIGAA:  Student bond program not found');

    this.bonds.push(
      this.bondFactory.createStudentBond(registration, program, null)
    );
  }

  async getBonds(): Promise<BondType[]> {
    return this.bonds;
  }

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

  async getProfilePictureURL(): Promise<URL> {
    const page = await this.http.get('/sigaa/mobile/touch/menu.jsf');

    const pictureElement = page.$('div[data-role="fieldcontain"] img');
    if (pictureElement.length === 0)
      throw new Error('SIGAA: User has no picture.');

    const pictureSrc = pictureElement.attr('src');
    if (!pictureSrc || pictureSrc.includes('/img/avatar.jpg'))
      throw new Error('SIGAA: User has no picture.');

    return new URL(pictureSrc, page.url);
  }

  async downloadProfilePicture(
    basepath: string,
    callback?: ProgressCallback
  ): Promise<string> {
    const pictureURL = await this.getProfilePictureURL();
    return this.http.downloadFileByGet(pictureURL.href, basepath, callback);
  }

  async getName(): Promise<string> {
    const page = await this.http.get('/sigaa/portais/discente/discente.jsf');
    if (page.statusCode === 200) {
      const username = this.parser.removeTagsHtml(
        page.$('p.usuario > span').html()
      );
      return username;
    } else {
      throw new Error('SIGAA: unexpected status code at student profile page.');
    }
  }

  /**
   * Change the password of account
   * @async
   * @param oldPassword current Password
   * @param newPassword new password
   * @throws {errorInvalidCredentials} If current password is not correct
   * @throws {errorInsufficientPasswordComplexity} If the new password does not have the complexity requirement
   */
  async changePassword(
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    const formPage = await this.http.get('/sigaa/alterar_dados.jsf');
    if (formPage.statusCode !== 302)
      throw new Error('SIGAA: unexpected status code at change password form.');

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
