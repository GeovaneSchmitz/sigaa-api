import { HTTPSession } from './sigaa-http-session';
import { BondController } from './sigaa-bond-controller';
import { HTTP, SigaaHTTP } from './sigaa-http';
import { SigaaHTTPWithBond } from './sigaa-http-with-bond';
import { PageCacheWithBond } from './sigaa-page-cache-with-bond';

/**
 * @category Internal
 */
export interface HTTPFactory {
  /**
   * Return a instance without bond
   */
  createHttp(): HTTP;
  /**
   * Return http instance with bond
   * @param string bondId
   */
  createHttpWithBond(bondSwitchUrl: URL): HTTP;
}
/**
 * Class responsible for creating a new http instance
 * @category Internal
 *
 */
export class SigaaHTTPFactory implements HTTPFactory {
  constructor(
    private session: HTTPSession,
    private pageCacheWithBond: PageCacheWithBond,
    private bondController: BondController
  ) {}

  /**
   * @inheritdoc
   */
  createHttp(): HTTP {
    return new SigaaHTTP(this.session);
  }

  /**
   * @inheritdoc
   */
  createHttpWithBond(bondSwitchUrl: URL): HTTP {
    return new SigaaHTTPWithBond(
      new SigaaHTTP(this.session),
      this.bondController,
      this.pageCacheWithBond,
      bondSwitchUrl
    );
  }
}
