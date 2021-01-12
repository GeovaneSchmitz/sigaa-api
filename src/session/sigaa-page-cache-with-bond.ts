import { HTTPRequestOptions } from './sigaa-http';
import { Page } from './sigaa-page';
import { PageCache } from './sigaa-page-cache';
import { PageCacheFactory } from './sigaa-page-cache-factory';

/**
 * @category Internal
 */
export interface PageCacheWithBond extends PageCache {
  /**
   *Define the current bond, each bond has its own cache
   */
  setCurrentBond(bondSwitchUrl: string | null): void;
}

/**
 * Transforms the cache mechanism to be dependent on the current bond.
 * @category Internal
 */
export class SigaaPageCacheWithBond implements PageCacheWithBond {
  /**
   * Cache for the current bond
   */
  private currentCache: PageCache;

  /**
   * Current bond
   */
  private currentBond: null | string = null;

  constructor(private cachePageFactory: PageCacheFactory) {
    this.currentCache = this.cachePageFactory.createPageCache();
  }

  /**
   * @inheritdoc
   */
  setCurrentBond(bondSwitchUrl: string | null): void {
    if (bondSwitchUrl !== this.currentBond) {
      this.currentCache.clearCachePage();
      this.currentBond = bondSwitchUrl;
    }
  }

  /**
   * @inheritdoc
   */
  getPage(
    httpOptions: HTTPRequestOptions,
    body?: string | Buffer
  ): Page | undefined {
    return this.currentCache.getPage(httpOptions, body);
  }

  /**
   * @inheritdoc
   */
  storePage(page: Page): void {
    return this.currentCache.storePage(page);
  }

  /**
   * @inheritdoc
   */
  clearCachePage(): void {
    this.currentCache.clearCachePage();
  }
}
