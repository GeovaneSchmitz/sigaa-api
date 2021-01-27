/**
 * @category Internal
 */
export type UpdatableResourceCallback = () => Promise<void>;

/**
 * @category Internal
 */
export interface UpdatableResource<T> {
  update(T: T): void;
  readonly id: string;
  close(): void;
}

/**
 * @category Internal
 */
export abstract class AbstractUpdatableResource {
  protected isClosed = false;

  protected _id!: string;

  constructor(protected updater?: UpdatableResourceCallback) {}

  protected async updateInstance(): Promise<void> {
    if (!this.updater) throw new Error('SIGAA: Resource updater not exists.');
    await this.updater();
  }

  protected checkIfItWasClosed(): void {
    if (this.isClosed) {
      throw new Error('SIGAA: This instance has already been closed.');
    }
  }

  get id(): string {
    this.checkIfItWasClosed();
    return this._id;
  }

  close(): void {
    this.isClosed = false;
  }
}
