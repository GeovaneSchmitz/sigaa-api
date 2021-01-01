import { isEqual } from 'lodash';
import { HTTPRequestOptions } from './sigaa-http';
import { Page } from './sigaa-page';

export interface PageCache {
  /**
   * Get Page from cache
   */
  getPage(
    httpOptions: HTTPRequestOptions,
    body?: string | Buffer
  ): Page | undefined;

  /**
   * Cache a page or update if the same request values
   * @param page
   */
  storePage(page: Page): void;

  /**
   * Flush states of instance
   */
  clearCachePage(): void;
}

/**
 * @class SigaaSession
 * Store information like: states, cookies, page cache
 */
export class SigaaPageCache implements PageCache {
  /**
   * @property {SigaaPage} Array of all pages in cache
   * @private
   */
  private cachePages: Page[] = [];

  /**
   * @property {NodeJS.Timeout | null } intervalId interval id to clear the cache
   */
  private intervalId?: NodeJS.Timeout;

  /**
   * Cache page timeout, default is 5 min
   */
  public timeoutCache = 5 * 60 * 1000; // 5min

  /**
   * Flush states of instance
   */
  clearCachePage(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.cachePages = [];
  }

  storePage(page: Page): void {
    if (this.intervalId === undefined) {
      this.intervalId = setInterval(() => {
        this.cachePages = this.cachePages.filter((cachePage) => {
          return !(cachePage.modifiedAt < Date.now() - this.timeoutCache);
        });
        if (this.cachePages.length === 0 && this.intervalId !== undefined) {
          clearInterval(this.intervalId);
        }
      }, this.timeoutCache);
    }
    const replace = false;
    this.cachePages = this.cachePages.map((cachePage) => {
      if (
        isEqual(page.requestOptions, cachePage.requestOptions) &&
        page.body === cachePage.requestBody
      ) {
        return page;
      } else {
        return cachePage;
      }
    });

    if (!replace) {
      this.cachePages.push(page);
    }
    if (this.cachePages.length > 15) {
      this.cachePages.shift();
    }
  }

  getPage(
    httpOptions: HTTPRequestOptions,
    body?: string | Buffer
  ): Page | undefined {
    return this.cachePages.find(
      (cachePage) =>
        isEqual(httpOptions, cachePage.requestOptions) &&
        (body === undefined || body === cachePage.requestBody)
    );
  }
}
