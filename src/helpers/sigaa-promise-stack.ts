type PromiseStackOrder = 'normal' | 'reverse';

export interface FunctionPromise<T> {
  (): Promise<T>;
}

export interface PromiseItemStack<K, T> {
  key: K;
  promiseFunction?(): Promise<void>;
  promise?: Promise<T>;
}

interface PromiseStack<K, T> {
  /**
   * Add promise in stack
   * @param promiseFunction function to generate the promise
   * @param key key of promise array
   * @return {Promise} promise execution
   * @async
   */
  addPromise(key: K, promiseFunction: FunctionPromise<T>): Promise<T>;

  /**
   * get promises objects
   */
  readonly promises: PromiseItemStack<K, T>[];
}

/**
 * Class to control promise order
 * @class SigaaStackPromise
 * @private
 */
export class SigaaPromiseStack<K, T> implements PromiseStack<K, T> {
  /**
   * Order type
   * if it is reverse, the last entered will be the first executed. default is normal
   * @property {PromiseStackOrder}
   * @private
   */
  order: PromiseStackOrder;

  /**
   * Current promise running object as {key, promiseFunction, promise}
   * @property {Object}
   * @private
   */
  promiseRunning?: PromiseItemStack<K, T>;

  /**
   * store all promises objects as {key, promiseFunction, promise}
   * @property {Array<promiseItemStack<K,T>>}
   * @private
   */
  storedPromises: PromiseItemStack<K, T>[] = [];

  /**
   * @param PromiseStackOrder [order] order of execution of the promises, if it is reverse, the last entered will be the first executed. default is normal
   */
  constructor(order?: PromiseStackOrder) {
    this.order = order || 'normal';
  }

  /**
   * get promises objects
   */
  get promises(): PromiseItemStack<K, T>[] {
    if (this.promiseRunning) {
      return [this.promiseRunning, ...this.storedPromises];
    } else {
      return this.storedPromises;
    }
  }

  /**
   * Loop to execute the entire promise stack
   */
  private async promiseExecutor(): Promise<void> {
    if (!this.promiseRunning) {
      while (this.storedPromises.length > 0) {
        if (this.order === 'normal') {
          this.promiseRunning = this.storedPromises.shift();
        } else if (this.order === 'reverse') {
          this.promiseRunning = this.storedPromises.pop();
        }
        try {
          if (this.promiseRunning?.promiseFunction) {
            await this.promiseRunning.promiseFunction();
          }
        } finally {
          this.promiseRunning = undefined;
        }
      }
    }
  }

  /**
   * Add promise in stack
   * @param promiseFunction function to generate the promise
   * @param key key of promise array
   * @async
   */
  public addPromise(key: K, promiseFunction: FunctionPromise<T>): Promise<T> {
    const promiseObject: PromiseItemStack<K, T> = { key };
    const promise = new Promise<T>((resolve, reject) => {
      promiseObject.promiseFunction = () => {
        return promiseFunction().then(resolve, reject);
      };
    });
    promiseObject.promise = promise;
    this.storedPromises.push(promiseObject);
    this.promiseExecutor();

    return promise;
  }
}
