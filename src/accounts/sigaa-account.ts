import { Parser } from '@helpers/sigaa-parser';
import { HTTP } from '@session/sigaa-http';
import { Page } from '@session/sigaa-page';
import { Session } from '@session/sigaa-session';
import { LoginStatus } from '../sigaa-types';
import { URL } from 'url';
import { SigaaAccountStudent } from './sigaa-account-student';
import { SigaaAccountTeacher } from './sigaa-account-teacher';

export interface Account {
  logoff(): Promise<void>;

  /**
   * Check that the session is userType of the class
   */
  verifyIfUserType(page: Page): Promise<boolean>;
}

export type AccountType = SigaaAccountTeacher | SigaaAccountStudent;

export class SigaaAccount implements Account {
  /**
   * userType
   */
  readonly errorInvalidCredentials = 'SIGAA: Invalid credentials.';
  readonly errorInsufficientPasswordComplexity =
    'SIGAA: Insufficent password complexity.';
  constructor(
    protected http: HTTP,
    protected parser: Parser,
    protected session: Session
  ) {}

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
        this.session.accounts = undefined;
        this.session.loginStatus = LoginStatus.Unauthenticated;
        this.http.closeSession();
      });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  verifyIfUserType(page: Page): Promise<boolean> {
    throw new Error('SIGAA: verifyIfUserType not implemented.');
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
