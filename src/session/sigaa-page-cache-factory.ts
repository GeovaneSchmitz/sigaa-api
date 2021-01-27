import { PageCache, SigaaPageCache } from './sigaa-page-cache';

/**
 * Responsible for creating a cache instance
 * @category Internal
 */
export interface PageCacheFactory {
  createPageCache(): PageCache;
}

/**
 * Responsible for creating a cache instance
 * @category Internal
 */
export class SigaaPageCacheFactory implements PageCacheFactory {
  createPageCache(): PageCache {
    return new SigaaPageCache();
  }
}
