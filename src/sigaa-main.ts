import { Account } from '@account/sigaa-account';
import { BondFactory, SigaaBondFactory } from '@bonds/sigaa-bond-factory';
import { Parser, SigaaParser } from '@helpers/sigaa-parser';
import { FileData, SigaaFile } from '@resources/sigaa-file';
import { SigaaSearch } from '@search/sigaa-search';
import { HTTPSession, SigaaHTTPSession } from '@session/sigaa-http-session';
import { HTTP } from '@session/sigaa-http';
import { HTTPFactory, SigaaHTTPFactory } from '@session/sigaa-http-factory';
import { Login, SigaaLogin } from '@session/sigaa-login';
import { Session, SigaaSession } from '@session/sigaa-session';
import { SigaaTokens } from '@session/sigaa-tokens';
import { SigaaPageCacheWithBond } from '@session/sigaa-page-cache-with-bond';
import { SigaaPageCacheFactory } from '@session/sigaa-page-cache-factory';

import {
  AccountFactory,
  SigaaAccountFactory
} from '@account/sigaa-account-factory';
import {
  BondController,
  SigaaBondController
} from '@session/sigaa-bond-controller';
import {
  CourseFactory,
  SigaaCourseFactory
} from '@courses/sigaa-course-student-factory';
import {
  CourseResourcesManagerFactory,
  SigaaCourseResourceManagerFactory
} from '@courses/sigaa-course-resources-manager-factory';
import {
  CourseResourcesFactory,
  SigaaCourseResourcesFactory
} from '@courses/sigaa-course-resources-factory';
import {
  LessonParserFactory,
  SigaaLessonParserFactory
} from '@courses/sigaa-lesson-parser-factory';

/**
 * @category Internal
 */
interface SigaaCommonConstructorOptions {
  session?: Session;
  login?: Login;
  parser?: Parser;
}

interface SigaaConstructorURL {
  url: string;
  bondController?: BondController;
}

interface WithAccountFactory {
  accountFactory?: AccountFactory;
}
interface WithBondFactory {
  bondFactory: BondFactory;
}
interface WithCourseFactory {
  courseFactory: CourseFactory;
}

type WithoutCourseFactory = {
  lessonParserFactory?: LessonParserFactory;
} & XOR<
  { courseResourcesManagerFactory?: CourseResourcesManagerFactory },
  { courseResourcesFactory?: CourseResourcesFactory }
>;
/**
 * @category Internal
 */
interface SigaaConstructorHTTP {
  httpFactory: HTTPFactory;
  httpSession: HTTPSession;
}

type Without<T, U> = {
  [P in Exclude<keyof T, keyof U>]?: never;
};
type XOR<T, U> = (Without<T, U> & U) | (Without<U, T> & T);

/**
 * @category Public
 */
export type SigaaOptionsConstructor = SigaaCommonConstructorOptions &
  XOR<SigaaConstructorURL, SigaaConstructorHTTP> &
  XOR<
    WithAccountFactory,
    XOR<WithBondFactory, XOR<WithCourseFactory, WithoutCourseFactory>>
  >;

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
    const pageCacheFactory = new SigaaPageCacheFactory();
    const pageCache = new SigaaPageCacheWithBond(pageCacheFactory);

    if ('parser' in options && options.parser) {
      this.parser = options.parser;
    } else {
      this.parser = new SigaaParser();
    }

    if ('session' in options && options.session) {
      this.session = options.session;
    } else {
      this.session = new SigaaSession();
    }

    if ('url' in options && options.url) {
      const tokens = new SigaaTokens();
      this.httpSession = new SigaaHTTPSession(options.url, tokens, pageCache);

      const bondController =
        options.bondController || new SigaaBondController();

      this.httpFactory = new SigaaHTTPFactory(
        this.httpSession,
        pageCache,
        bondController
      );
    } else {
      if ('httpFactory' in options && options.httpFactory) {
        this.httpFactory = options.httpFactory;
      } else {
        throw new Error(
          'SIGAA: Invalid httpFactory. It may be that you have forgotten the URL'
        );
      }
      if ('httpSession' in options && options.httpSession) {
        this.httpSession = options.httpSession;
      } else {
        throw new Error('SIGAA: Invalid httpSession.');
      }
    }

    this.http = this.httpFactory.createHttp();

    if ('accountFactory' in options && options.accountFactory) {
      this.accountFactory = options.accountFactory;
    } else {
      let bondFactory: BondFactory;

      if ('bondFactory' in options && options.bondFactory) {
        bondFactory = options.bondFactory;
      } else {
        let courseFactory: CourseFactory;

        if ('courseFactory' in options && options.courseFactory) {
          courseFactory = options.courseFactory;
        } else {
          let courseResourcesManagerFactory: CourseResourcesManagerFactory;

          if (
            'courseResourcesManagerFactory' in options &&
            options.courseResourcesManagerFactory
          ) {
            courseResourcesManagerFactory =
              options.courseResourcesManagerFactory;
          } else {
            let courseResourcesFactory: CourseResourcesFactory;

            if (
              'courseResourcesFactory' in options &&
              options.courseResourcesFactory
            ) {
              courseResourcesFactory = options.courseResourcesFactory;
            } else {
              courseResourcesFactory = new SigaaCourseResourcesFactory(
                this.parser
              );
            }

            courseResourcesManagerFactory = new SigaaCourseResourceManagerFactory(
              courseResourcesFactory
            );
          }

          let lessonParserFactory: LessonParserFactory;

          if ('lessonParserFactory' in options && options.lessonParserFactory) {
            lessonParserFactory = options.lessonParserFactory;
          } else {
            lessonParserFactory = new SigaaLessonParserFactory(this.parser);
          }

          courseFactory = new SigaaCourseFactory(
            this.http,
            this.parser,
            courseResourcesManagerFactory,
            lessonParserFactory
          );
        }

        bondFactory = new SigaaBondFactory(
          this.httpFactory,
          this.parser,
          courseFactory
        );
      }
      this.accountFactory = new SigaaAccountFactory(
        this.http,
        this.parser,
        this.session,
        bondFactory
      );
    }

    this.loginInstance =
      options.login || new SigaaLogin(this.http, this.session);
  }

  /**
   * User authentication.
   * @param username
   * @param password
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
