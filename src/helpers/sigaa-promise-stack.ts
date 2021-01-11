type PromiseStackOrder = 'normal' | 'reverse';

/**
 * @category Internal
 */
export interface FunctionPromise<T> {
  (): Promise<T>;
}

/**
 * Item in stack.
 * @category Internal
 */
export interface PromiseItemStack<K, T> {
  key: K;
  promiseFunction?(): Promise<void>;
  promise?: Promise<T>;
}

/**
 * Abstraction to represent a class that performs chain functions and waits for each promise that the functions return.
 * @category Internal
 */
interface PromiseStack<K, T> {
  /**
   * Add promise in stack.
   * The function is not called the moment it is added to the stack, but when it is your turn on the stack
   * @param promiseFunction function to generate the promise
   * @param key Key of promise array, to identify a function.
   * @return {Promise} Returns a promise that resolves with the function's response.
   */
  addPromise(key: K, promiseFunction: FunctionPromise<T>): Promise<T>;

  /**
   * Get promises objects.
   * Returns the functions that are still in the stack.
   */
  readonly promises: PromiseItemStack<K, T>[];
}

/**
 * Class to control promise order
 * Performs chain functions and waits for each promise that the functions return.
 * @category Internal
 */
export class SigaaPromiseStack<K, T> implements PromiseStack<K, T> {
  /**
   * Order type.
   * If it is reverse, the last entered will be the first executed. default is normal.
   */
  private order: PromiseStackOrder;

  /**
   * Current promise running object as {key, promiseFunction, promise}.
   */
  private promiseRunning?: PromiseItemStack<K, T>;

  /**
   * store all promises objects as {key, promiseFunction, promise}
   */
  private storedPromises: PromiseItemStack<K, T>[] = [];

  /**
   * @param PromiseStackOrder [order] order of execution of the promises, if it is reverse, the last entered will be the first executed. default is normal.
   */
  constructor(order?: PromiseStackOrder) {
    this.order = order || 'normal';
  }

  /**
   * Get promises objects.
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
   * Add promise in stack.
   * The function is not called the moment it is added to the stack, but when it is your turn on the stack
   * @param promiseFunction function to generate the promise
   * @param key Key of promise array, to identify a function.
   * @return {Promise} Returns a promise that resolves with the function's response.
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
