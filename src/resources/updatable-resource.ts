/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * @category Internal
 */
export type UpdatableResourceCallback = () => Promise<void>;

/**
 * @category Internal
 */
export abstract class UpdatableResource<T> {
  protected isClosed = false;

  protected _id!: string;

  constructor(protected updater?: UpdatableResourceCallback) {}

  protected async updateInstance(): Promise<void> {
    if (!this.updater) throw new Error('SIGAA: Resource updater not exists.');
    await this.updater();
  }

  public update(T: T): void {
    throw new Error('SIGAA: Update method not implemented.');
  }

  checkIfItWasClosed(): void {
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
