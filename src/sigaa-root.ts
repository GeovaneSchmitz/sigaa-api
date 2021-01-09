import { Account } from '@account/sigaa-account';
import {
  AccountFactory,
  SigaaAccountFactory
} from '@account/sigaa-account-factory';
import { BondFactory, SigaaBondFactory } from '@bonds/sigaa-bond-factory';
import { Parser, SigaaParser } from '@helpers/sigaa-parser';
import { FileData, SigaaFile } from '@resources/sigaa-file';
import { SigaaSearch } from '@search/sigaa-search';
import { SigaaHTTPSession } from '@session/http-session';
import {
  BondController,
  SigaaBondController
} from '@session/sigaa-bond-controller';
import { HTTP } from '@session/sigaa-http';
import { HTTPFactory, SigaaHTTPFactory } from '@session/sigaa-http-factory';
import { Login, SigaaLogin } from '@session/sigaa-login';
import { SigaaPageCache } from '@session/sigaa-page-cache';
import { Session, SigaaSession } from '@session/sigaa-session';
import { SigaaTokens } from '@session/sigaa-tokens';

interface SigaaConstructorURL {
  url: string;
  session?: Session;
  login?: Login;
  parser?: Parser;
  accountFactory?: AccountFactory;
  bondController?: BondController;
  bondFactory?: BondFactory;
}

interface SigaaConstructorHTTP {
  httpFactory: HTTPFactory;
  session?: Session;
  login?: Login;
  parser?: Parser;
  accountFactory: AccountFactory;
}

export type SigaaOptionsConstructor =
  | SigaaConstructorURL
  | SigaaConstructorHTTP;

export class Sigaa {
  readonly loginInstance: Login;
  readonly httpFactory: HTTPFactory;
  readonly parser: Parser;
  readonly session: Session;
  readonly accountFactory: AccountFactory;
  private http: HTTP;

  constructor(options: SigaaOptionsConstructor) {
    const optionsTypeURL = <SigaaConstructorURL>options;
    const optionsTypeHttp = <SigaaConstructorHTTP>options;

    this.parser = options.parser || new SigaaParser();
    this.session = options.session || new SigaaSession();

    if (!optionsTypeHttp.httpFactory) {
      const pageCache = new SigaaPageCache();
      const tokens = new SigaaTokens();
      const session = new SigaaHTTPSession(
        optionsTypeURL.url,
        tokens,
        pageCache
      );

      const bondController =
        optionsTypeURL.bondController || new SigaaBondController();

      this.httpFactory = new SigaaHTTPFactory(session, bondController);

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
    }
    this.http = this.httpFactory.createHttp();
    this.loginInstance =
      options.login || new SigaaLogin(this.http, this.session);
  }

  /**
   * User authentication
   * @param username
   * @param password
   * @async
   * @returns
   */
  async login(username: string, password: string): Promise<Account> {
    const page = await this.loginInstance.login(username, password);
    return this.accountFactory.getAccount(page);
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

  get sigaaSearch(): SigaaSearch {
    return new SigaaSearch(this.http, this.parser);
  }
}
