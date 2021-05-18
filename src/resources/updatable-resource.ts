/**
 * @category Internal
 */
export type UpdatableResourceCallback = () => Promise<void>;

/**
 * @category Internal
 */
export interface UpdatableResource<T> {
  update(T: T): void;
  readonly _instanceIndentifier: string;
  close(): void;
}

/**
 * @category Internal
 */
export abstract class AbstractUpdatableResource {
  protected isClosed = false;

  constructor(
    protected __instanceIndentifier: string,
    protected updater?: UpdatableResourceCallback
  ) {}

  protected async updateInstance(): Promise<void> {
    if (!this.updater) throw new Error('SIGAA: Resource updater not exists.');
    await this.updater();
  }

  protected checkIfItWasClosed(): void {
    if (this.isClosed) {
      throw new Error('SIGAA: This instance has already been closed.');
    }
  }

  get _instanceIndentifier(): string {
    return this.__instanceIndentifier;
  }

  close(): void {
    this.isClosed = false;
  }
}
