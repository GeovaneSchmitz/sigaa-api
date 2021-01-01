import { AccountType } from '@accounts/sigaa-account';
import { LoginStatus } from '../sigaa-types';

/**
 * Manage a Sigaa session
 */
export interface Session {
  accounts?: AccountType[];
  loginStatus: LoginStatus;
}

export class SigaaSession implements Session {
  account?: AccountType[];
  loginStatus: LoginStatus = LoginStatus.Unauthenticated;
}
