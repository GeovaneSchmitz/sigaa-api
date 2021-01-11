import { Account } from '@account/sigaa-account';
import {
  AccountFactory,
  SigaaAccountFactory
} from '@account/sigaa-account-factory';
import { BondFactory, SigaaBondFactory } from '@bonds/sigaa-bond-factory';
import { Parser, SigaaParser } from '@helpers/sigaa-parser';
import { FileData, SigaaFile } from '@resources/sigaa-file';
import { SigaaSearch } from '@search/sigaa-search';
import { HTTPSession, SigaaHTTPSession } from '@session/sigaa-http-session';
import {
  BondController,
  SigaaBondController
} from '@session/sigaa-bond-controller';
import { HTTP } from '@session/sigaa-http';
import { HTTPFactory, SigaaHTTPFactory } from '@session/sigaa-http-factory';
import { Login, SigaaLogin } from '@session/sigaa-login';
import { Session, SigaaSession } from '@session/sigaa-session';
import { SigaaTokens } from '@session/sigaa-tokens';
import { SigaaPageCacheWithBond } from '@session/sigaa-page-cache-with-bond';
import { SigaaPageCacheFactory } from '@session/sigaa-page-cache-factory';

/**
 * @category Internal
 */
interface SigaaConstructorURL {
  url: string;
  session?: Session;
  login?: Login;
  parser?: Parser;
  accountFactory?: AccountFactory;
  bondController?: BondController;
  bondFactory?: BondFactory;
}

/**
 * @category Internal
 */
interface SigaaConstructorHTTP {
  httpFactory: HTTPFactory;
  session?: Session;
  login?: Login;
  parser?: Parser;
  accountFactory: AccountFactory;
  httpSession: HTTPSession;
}

/**
 * @category Public
 */
export type SigaaOptionsConstructor =
  | SigaaConstructorURL
  | SigaaConstructorHTTP;

/**
 * Main class, used to instantiate other classes in standard use.
 * @category Public
 */
export class Sigaa {
  /**
   * Instance of login class.
   */
  readonly loginInstance: Login;

  /**
   * Instance of http factory.
   */
  readonly httpFactory: HTTPFactory;

  /**
   * Instance of parser.
   */
  readonly parser: Parser;

  /**
   * Instance of session.
   */
  readonly session: Session;

  /**
   * Instance of account factory.
   */
  readonly accountFactory: AccountFactory;

  /**
   * Instance of http session.
   */
  readonly httpSession: HTTPSession;

  /**
   * Instance of http.
   */
  private http: HTTP;

  constructor(options: SigaaOptionsConstructor) {
    const optionsTypeURL = <SigaaConstructorURL>options;
    const optionsTypeHttp = <SigaaConstructorHTTP>options;

    const pageCacheFactory = new SigaaPageCacheFactory();
    const pageCache = new SigaaPageCacheWithBond(pageCacheFactory);

    this.parser = options.parser || new SigaaParser();
    this.session = options.session || new SigaaSession();

    if (!optionsTypeHttp.httpFactory) {
      const tokens = new SigaaTokens();
      this.httpSession = new SigaaHTTPSession(
        optionsTypeURL.url,
        tokens,
        pageCache
      );

      const bondController =
        optionsTypeURL.bondController || new SigaaBondController();

      this.httpFactory = new SigaaHTTPFactory(
        this.httpSession,
        pageCache,
        bondController
      );

      const bondFactory =
        optionsTypeURL.bondFactory ||
        new SigaaBondFactory(this.httpFactory, this.parser);

      const http = this.httpFactory.createHttp();
      this.accountFactory = new SigaaAccountFactory(
        http,
        this.parser,
        this.session,
        bondFactory
      );
    } else {
      this.httpFactory = optionsTypeHttp.httpFactory;
      this.accountFactory = optionsTypeHttp.accountFactory;
      this.httpSession = optionsTypeHttp.httpSession;
    }
    this.http = this.httpFactory.createHttp();
    this.loginInstance =
      options.login || new SigaaLogin(this.http, this.session);
  }

  /**
   * User authentication.
   * @param username
   * @param password
   * @returns
   */
  async login(username: string, password: string): Promise<Account> {
    const page = await this.loginInstance.login(username, password);
    return this.accountFactory.getAccount(page);
  }

  /**
   * Load file to download.
   * @param options
   * @param options.id file id
   * @param options.key file key
   * @returns
   */
  loadFile(options: FileData): SigaaFile {
    return new SigaaFile(this.http, options);
  }

  /**
   * Returns instance of SigaaSearch.
   */
  get search(): SigaaSearch {
    return new SigaaSearch(this.http, this.parser);
  }

  /**
   * Close the instance, it just clears the session data, if you want to log off the system you must use Account.logoff().
   */
  close(): void {
    this.httpSession.close();
  }
}
