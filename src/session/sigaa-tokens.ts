/**
 * Store cookies.
 * @category Internal
 */
export interface Token {
  /**
   * Returns domain cookie JSESSIONID (token) or null if nothing.
   * @param domain domain of cookie
   * @returns cookie string or null if not found.
   */
  getTokenByDomain(domain: string): string | null;

  /**
   * Store cookie JSESSIONID (token) for domain URL.
   * @param domain Token URL domain without https:// only URL hostname
   * @param token token to store
   */
  setToken(domain: string, token: string): void;

  /**
   * flush all cookies
   */
  clearTokens(): void;

  /**
   * Cookies key as domain and value as cookie string.
   */
  readonly tokens: Record<string, string>;
}

/**
 * Store cookies.
 * @category Internal
 */
export class SigaaTokens implements Token {
  /**
   * Cookies key as domain and value as cookie string.
   */
  private _tokens: Record<string, string> = {};

  /**
   * @inheritdoc
   */
  getTokenByDomain(domain: string): string | null {
    return this._tokens[domain] || null;
  }

  /**
   * @inheritdoc
   */
  setToken(domain: string, token: string): void {
    this._tokens[domain] = token;
  }

  /**
   * @inheritdoc
   */
  clearTokens(): void {
    this._tokens = {};
  }

  /**
   * @inheritdoc
   */
  get tokens(): Record<string, string> {
    return this._tokens;
  }
}
