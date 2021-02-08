import { LoginStatus } from '../sigaa-types';
import { URL } from 'url';
import { HTTP } from './sigaa-http';
import { Page, SigaaForm } from './sigaa-page';
import { Session } from './sigaa-session';

/**
 * Abstraction representing class that logs in.
 *
 * @category Internal
 */
export interface Login {
  /**
   * Login on Sigaa
   * @param username
   * @param password'
   * @returns Login page result.
   */
  login(username: string, password: string): Promise<Page>;
}

/**
 * Responsible for logging in.
 * @category Internal
 */
export class SigaaLogin implements Login {
  constructor(protected http: HTTP, protected session: Session) {}
  readonly errorInvalidCredentials = 'SIGAA: Invalid credentials.';

  protected parseLoginForm(page: Page): SigaaForm {
    const formElement = page.$("form[name='loginForm']");

    const actionUrl = formElement.attr('action');

    if (!actionUrl) throw new Error('SIGAA: No action form on login page.');

    const action = new URL(actionUrl, page.url.href);

    const postValues: Record<string, string> = {};

    formElement.find('input').each((index, element) => {
      const name = page.$(element).attr('name');
      if (name) postValues[name] = page.$(element).val();
    });

    return { action, postValues };
  }

  /**
   * Current login form.
   */
  protected form?: SigaaForm;

  /**
   * Retuns HTML form
   */
  async getLoginForm(): Promise<SigaaForm> {
    if (this.form) {
      return this.form;
    } else {
      const page = await this.http.get('/sigaa/verTelaLogin.do');
      return this.parseLoginForm(page);
    }
  }

  /**
   * Start a session on desktop
   * @param username
   * @param password
   */
  protected async desktopLogin(
    username: string,
    password: string
  ): Promise<Page> {
    const { action, postValues } = await this.getLoginForm();

    postValues['user.login'] = username;
    postValues['user.senha'] = password;
    const page = await this.http.post(action.href, postValues);
    return await this.parseDesktopLoginResult(page);
  }

  /**
   * Start a session on Sigaa, return login reponse page
   * @param username
   * @param password
   */
  async login(username: string, password: string, retry = true): Promise<Page> {
    if (this.session.loginStatus === LoginStatus.Authenticated)
      throw new Error('SIGAA: This session already has a user logged in.');
    try {
      const page = await this.desktopLogin(username, password);
      return this.http.followAllRedirect(page);
    } catch (error) {
      if (!retry || error.message === this.errorInvalidCredentials) {
        throw error;
      } else {
        return this.login(username, password, false);
      }
    }
  }

  protected async parseDesktopLoginResult(page: Page): Promise<Page> {
    const accountPage = await this.http.followAllRedirect(page);
    if (accountPage.body.includes('Entrar no Sistema')) {
      if (accountPage.body.includes('Usu&#225;rio e/ou senha inv&#225;lidos')) {
        this.form = await this.parseLoginForm(accountPage);
        throw new Error(this.errorInvalidCredentials);
      } else {
        throw new Error('SIGAA: Invalid response after login attempt.');
      }
    } else {
      this.session.loginStatus = LoginStatus.Authenticated;
      return accountPage;
    }
  }
}
