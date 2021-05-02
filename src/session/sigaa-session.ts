import { LoginStatus } from '../sigaa-types';

/**
 * The institution serves to adjust interactions with SIGAA.
 * @category Public
 */
export type InstituionType = 'IFSC' | 'UFPB';

/**
 * Sigaa session control
 * @category Internal
 */
export interface Session {
  readonly institution: InstituionType;
  loginStatus: LoginStatus;
}

/**
 * @category Internal
 */
export class SigaaSession implements Session {
  constructor(public readonly institution: InstituionType = 'IFSC') {}
  loginStatus: LoginStatus = LoginStatus.Unauthenticated;
}
