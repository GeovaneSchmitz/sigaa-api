import { BondFactory } from '@bonds/sigaa-bond-factory';
import { Parser } from '@helpers/sigaa-parser';
import { HTTP } from '@session/sigaa-http';
import { Page } from '@session/sigaa-page';
import { Session } from '@session/sigaa-session';
import { SigaaAccount, Account } from './sigaa-account';

export interface AccountFactory {
  /**
   * creates account instance.
   * @param page result login page
   */
  getAccount: (page: Page) => Promise<Account>;
}

export class SigaaAccountFactory implements AccountFactory {
  constructor(
    private http: HTTP,
    private parser: Parser,
    private session: Session,
    private bondFactory: BondFactory
  ) {}

  async getAccount(page: Page): Promise<Account> {
    return new SigaaAccount(
      page,
      this.http,
      this.parser,
      this.session,
      this.bondFactory
    );
  }
}
