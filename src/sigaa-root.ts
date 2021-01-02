import { AccountType } from '@accounts/sigaa-account';
import { SigaaAccountStudent } from '@accounts/sigaa-account-student';
import { SigaaAccountTeacher } from '@accounts/sigaa-account-teacher';
import { Parser, SigaaParser } from '@helpers/sigaa-parser';
import { FileData, SigaaFile } from '@resources/sigaa-file';
import { SigaaSearch } from '@search/sigaa-search';
import { SigaaHTTPSession } from '@session/http-session';
import { HTTP, SigaaHTTP } from '@session/sigaa-http';
import { Login, SigaaLogin } from '@session/sigaa-login';
import { SigaaPageCache } from '@session/sigaa-page-cache';
import { Session, SigaaSession } from '@session/sigaa-session';
import { SigaaTokens } from '@session/sigaa-tokens';

interface SigaaConstructorURL {
  url: string;
  session?: Session;
  login?: Login;
  parser?: Parser;
  accountTypes?: AccountType[];
}

interface SigaaConstructorHTTP {
  http: HTTP;
  session?: Session;
  login?: Login;
  parser?: Parser;
  accountTypes?: AccountType[];
}

export type SigaaOptionsConstructor =
  | SigaaConstructorURL
  | SigaaConstructorHTTP;

export class Sigaa {
  private loginInstance: Login;
  http: HTTP;
  parser: Parser;
  session: Session;

  constructor(options: SigaaOptionsConstructor) {
    if (!(<SigaaConstructorHTTP>options).http) {
      const pageCache = new SigaaPageCache();
      const tokens = new SigaaTokens();
      const session = new SigaaHTTPSession(
        (<SigaaConstructorURL>options).url,
        tokens,
        pageCache
      );
      this.http = new SigaaHTTP(session);
    } else {
      this.http = (<SigaaConstructorHTTP>options).http;
    }
    this.parser = options.parser || new SigaaParser();
    this.session = options.session || new SigaaSession();
    const accounts =
      options.accountTypes ||
      [SigaaAccountStudent, SigaaAccountTeacher].map(
        (AccountClass) => new AccountClass(this.http, this.parser, this.session)
      );
    this.loginInstance =
      options.login || new SigaaLogin(this.http, this.session, accounts);
  }

  /**
   * User authentication
   * @param username
   * @param password
   * @async
   * @returns
   */
  async login(username: string, password: string): Promise<AccountType[]> {
    return this.loginInstance.login(username, password);
  }

  /**
   * Load file to download
   * @param options
   * @param options.id  file id
   * @param options.key file key
   * @returns
   */
  loadFile(options: FileData): SigaaFile {
    return new SigaaFile(this.http, options);
  }

  get accounts(): AccountType[] {
    if (this.session.accounts) {
      return this.session.accounts;
    }
    return [];
  }

  get sigaaSearch(): SigaaSearch {
    return new SigaaSearch(this.http, this.parser);
  }
}
