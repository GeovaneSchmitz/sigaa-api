import { Page } from '../sigaa-page';

/**
 * Abstraction representing class that logs in.
 *
 * @category Internal
 */
export interface Login {
  /**
   * Login on Sigaa
   * @param username
   * @param password
   * @returns Login page result.
   */
  login(username: string, password: string): Promise<Page>;
}
