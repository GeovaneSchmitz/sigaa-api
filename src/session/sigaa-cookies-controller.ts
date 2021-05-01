/**
 * Store cookies.
 * @category Internal
 */
export interface CookiesController {
  /**
   * Returns domain cookie JSESSIONID (token) or null if nothing.
   * @param domain domain of request
   * @param path path of request
   * @returns cookie string or null if not found.
   */
  getCookieHeader(domain: string, path: string): string | null;

  /**
   * Store cookie JSESSIONID (token) for domain URL.
   * @param domain page domain without https://
   * @param cookies cookies to store (array of Set-Cookie header)
   */
  storeCookies(domain: string, cookies: string[]): void;

  /**
   * flush all cookies
   */
  clearCookies(): void;
}

interface Cookie {
  name: string;
  value: string;
  path?: string;
  expires?: Date;
  domain: string;
  domainFlag?: string;
}

/**
 * Store cookies.
 * @category Internal
 */
export class SigaaCookiesController implements CookiesController {
  /**
   * @inheritdoc
   */
  storeCookies(domain: string, cookies: string[]): void {
    for (let setCookie of cookies) {
      const cookieName = (setCookie.match(/^[^()<>@,;:\\" \t\n/[\]?={}]+/) ||
        [])[0];
      if (!cookieName) {
        continue;
      }
      setCookie = setCookie.substr(cookieName.length);
      //if cookie value start with double-quotes
      let cookieValue;
      if (setCookie.charAt(cookieName.length + 1) == '"') {
        cookieValue = (setCookie.substr(1).match(/^[^" \t\n,;\\]+/) || [])[0];
      } else {
        cookieValue = (setCookie.substr(1).match(/^[^" \t\n,;\\]+/) || [])[0];
      }
      if (!cookieValue) {
        break;
      }
      const cookie: Cookie = {
        name: cookieName,
        value: cookieValue,
        domain
      };

      setCookie = setCookie.substr(cookieValue.length + 3);
      let maxAgeFlagFound = false;
      let invalidCookie = false;
      //parse cookies flags
      const flags = setCookie.split('; ');
      for (const flag of flags) {
        if (flag.match(/^Path=/)) {
          cookie.path = flag.replace(/^Path=/, '');
        } else if (flag.match(/^Domain=/)) {
          const cookieDomainFlag = flag.replace(/^Domain=\.?/, '');
          if (('.' + domain).endsWith('.' + cookieDomainFlag)) {
            cookie.domainFlag = flag.replace(/^Domain=\.?/, '');
          } else {
            invalidCookie = true;
            break;
          }
        } else if (flag.match(/^Max-Age=/)) {
          maxAgeFlagFound = true;
          const maxAge = Number(flag.replace(/^Max-Age=/, ''));
          cookie.expires = new Date(Date.now() + maxAge);
        } else if (!maxAgeFlagFound && flag.match(/^Expires=/)) {
          const expires = flag.replace(/^Expires=/, '');
          cookie.expires = new Date(expires);
        }
      }
      if (!invalidCookie) this.cookies.unshift(cookie);
    }
  }
  /**
   * @inheritdoc
   */
  getCookieHeader(domain: string, path: string): string | null {
    const dateNow = Date.now();
    const validCookies: Cookie[] = this.cookies
      .filter((cookie) => !cookie.path || path.startsWith(cookie.path))
      .filter((cookie) =>
        ('.' + domain).endsWith('.' + (cookie.domainFlag || cookie.domain))
      )
      .filter(
        (cookie) => !cookie.expires || cookie.expires.valueOf() >= dateNow
      );

    if (validCookies.length === 0) return null;
    return validCookies
      .filter(
        //Filter duplicated cookie
        (cookie, index) =>
          index ===
          validCookies.findIndex(
            (findCookie) => findCookie.name === cookie.name
          )
      )
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join('; ');
  }

  /**
   * @inheritdoc
   */
  clearCookies(): void {
    this.cookies = [];
  }

  private cookies: Cookie[] = [];
}
