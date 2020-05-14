const SigaaErrors = require('./sigaa-errors')

/**
 * Class to control promise order
 * @class SigaaStackPromise
 * @private
 */
class SigaaPromiseStack {
  /**
   * @param {('normal'|'reverse')} [order] order of execution of the promises, if it is reverse, the last entered will be the first executed. default is normal
   * @throws {SigaaErros.SIGAA_STACK_INVALID_ORDER_TYPE} if order type is invalid
   */
  constructor(order) {
    if (order && order !== 'normal' && order !== 'reverse') {
      throw new Error(SigaaErrors.SIGAA_STACK_INVALID_ORDER_TYPE)
    }
    /**
     * order type
     * if it is reverse, the last entered will be the first executed. default is normal
     * @property {('normal'|'reverse')}
     * @private
     */
    this._order = order || 'normal'

    /**
     * If has any promise running
     * @property {boolean}
     * @private
     */
    this._hasPromiseRunning = false

    /**
     * Current promise running object as {key, promiseFunction, promise}
     * @property {Object}
     * @private
     */
    this._promiseRunning = null
    /**
     * store all promises objects as {key, promiseFunction, promise}
     * @property {Array<object>}
     * @private
     */
    this._promises = []
  }

  /**
   * get promises objects
   */
  get promises() {
    if (this._hasPromiseRunning) {
      return [this._promiseRunning, ...this._promises]
    } else {
      return this._promises
    }
  }

  /**
   * Loop to execute the entire promise stack
   */
  async _promiseExecutor() {
    if (!this._hasPromiseRunning) {
      while (this._promises.length > 0) {
        this._hasPromiseRunning = true
        if (this._order === 'normal') {
          this._promiseRunning = this._promises.shift()
        } else if (this._order === 'reverse') {
          this._promiseRunning = this._promises.pop()
        }
        try {
          await this._promiseRunning.promiseFunction()
        } finally {
          this._promiseRunning = null
        }
      }
      this._hasPromiseRunning = false
    }
  }

  /**
   * Add promise in stack
   * @param {Function} promiseFunction function to generate the promise
   * @param {any} key key of promise array
   * @return {Promise} promise execution
   * @async
   */
  addPromise(promiseFunction, key) {
    const promiseObject = { key }
    const promise = new Promise((resolve, reject) => {
      promiseObject.promiseFunction = () => {
        return promiseFunction().then(resolve, reject)
      }
    })
    promiseObject.promise = promise
    this._promises.push(promiseObject)
    this._promiseExecutor()
    return promise
  }
}
module.exports = SigaaPromiseStack
