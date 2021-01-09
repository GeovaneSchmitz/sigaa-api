import { HTTPSession } from './http-session';
import { BondController } from './sigaa-bond-controller';
import { HTTP, SigaaHTTP } from './sigaa-http';
import { SigaaHTTPWithBond } from './sigaa-http-with-bond';

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

export class SigaaHTTPFactory implements HTTPFactory {
  constructor(
    private session: HTTPSession,
    private bondController: BondController
  ) {}

  createHttp(): HTTP {
    return new SigaaHTTP(this.session);
  }

  createHttpWithBond(bondSwitchUrl: URL): HTTP {
    return new SigaaHTTPWithBond(
      new SigaaHTTP(this.session),
      this.bondController,
      bondSwitchUrl
    );
  }
}
