import { LoginStatus } from '../sigaa-types';

/**
 * Sigaa session control
 * @category Internal
 */
export interface Session {
  loginStatus: LoginStatus;
}

/**
 * @category Internal
 */
export class SigaaSession implements Session {
  loginStatus: LoginStatus = LoginStatus.Unauthenticated;
}
