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
   * login on Sigaa
   * @param username
   * @param password'
   * @returns login page result
   */
  login(username: string, password: string): Promise<Page>;
}

/**
 * Responsible for logging in.
 * @category Internal
 */
export class SigaaLogin implements Login {
  constructor(private http: HTTP, private session: Session) {}
  readonly errorInvalidCredentials = 'SIGAA: Invalid credentials.';

  /**
   * Get page of login
   */
  private async getMobileLoginPage(): Promise<Page> {
    return this.http
      .get('/sigaa/mobile/touch/login.jsf', {
        noCache: true,
        mobile: true
      })
      .then((page) => {
        if (page.statusCode === 200) {
          return page;
        }
        throw new Error('SIGAA: Mobile login page failed to load.');
      });
  }

  private async loadMobileLoginForm(): Promise<SigaaForm> {
    const mobilePage = await this.getMobileLoginPage();

    const page = mobilePage;
    const formElement = page.$('#form-login');

    const actionUrl = formElement.attr('action');

    if (!actionUrl) throw new Error('SIGAA: No action form on login page.');

    const action = new URL(actionUrl, mobilePage.url.href);

    const postValues: Record<string, string> = {};

    formElement.find('input').each((index, element) => {
      const name = page.$(element).attr('name');
      if (name) postValues[name] = page.$(element).val();
    });

    return { action, postValues };
  }

  private async loadDesktopLoginForm(): Promise<SigaaForm> {
    const page = await this.http.get('/sigaa/verTelaLogin.do');

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
   * Start a session on mobile page
   * @param username
   * @param password
   */
  private async mobileLogin(username: string, password: string): Promise<Page> {
    const { action, postValues } = await this.loadMobileLoginForm();

    const postValuesKeys = Object.keys(postValues);
    const usernameFormIndex = 1;
    const passwordFormIndex = 2;
    postValues[postValuesKeys[usernameFormIndex]] = username;
    postValues[postValuesKeys[passwordFormIndex]] = password;
    const page = await this.http.post(action.href, postValues, {
      mobile: true
    });
    return await this.parseMobileLoginResult(page);
  }

  /**
   * Start a session on desktop
   * @param username
   * @param password
   */
  private async desktopLogin(
    username: string,
    password: string
  ): Promise<Page> {
    const { action, postValues } = await this.loadDesktopLoginForm();

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
      const page = await this.mobileLogin(username, password).catch((error) => {
        if (error.message === this.errorInvalidCredentials) throw error;
        return this.desktopLogin(username, password);
      });
      return this.http.followAllRedirect(page);
    } catch (error) {
      if (!retry || error.message === this.errorInvalidCredentials) {
        throw error;
      } else {
        return this.login(username, password, false);
      }
    }
  }

  private async parseMobileLoginResult(page: Page): Promise<Page> {
    if (page.statusCode === 200) {
      if (page.body.includes('form-login')) {
        if (page.body.includes('Usu&#225;rio e/ou senha inv&#225;lidos')) {
          this.loadMobileLoginForm();
          throw new Error(this.errorInvalidCredentials);
        } else {
          throw new Error('SIGAA: Invalid response after login attempt.');
        }
      } else {
        // This is necessary because the mobile version does not return inactive bonds.
        if (
          page.url.href.includes('mobile') &&
          page.body.includes('Escolha seu V&#237;nculo para operar o sistema')
        ) {
          const bondPage = this.http.get('/sigaa/vinculos.jsf');
          if ((await bondPage).statusCode !== 200)
            throw new Error('SIGAA: Bond page has unexpected status.');
          this.session.loginStatus = LoginStatus.Authenticated;

          return bondPage;
        } else {
          this.session.loginStatus = LoginStatus.Authenticated;
          return page;
        }
      }
    } else {
      throw new Error('SIGAA: Invalid status code after login attempt.');
    }
  }

  private async parseDesktopLoginResult(page: Page): Promise<Page> {
    const accountPage = await this.http.followAllRedirect(page);
    if (accountPage.body.includes('Entrar no Sistema')) {
      if (accountPage.body.includes('Usu&#225;rio e/ou senha inv&#225;lidos')) {
        this.loadMobileLoginForm();
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
