import { LoginStatus } from '../sigaa-types';

/**
 * Sigaa session control
 */
export interface Session {
  loginStatus: LoginStatus;
}

export class SigaaSession implements Session {
  loginStatus: LoginStatus = LoginStatus.Unauthenticated;
}
