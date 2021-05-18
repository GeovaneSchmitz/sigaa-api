import { UpdatableResource } from '@resources/updatable-resource';

/**
 * @category Internal
 */
export interface UpdatableResourceData {
  instanceIndentifier: string;
}

/**
 * @category Internal
 */
export class ResourceManager<
  T extends UpdatableResource<U>,
  U extends UpdatableResourceData
> implements ResourceManager<T, U> {
  constructor(private instanceConstructor: (options: U) => T) {}

  /**
   * Current instances.
   */
  private _instances: T[] = [];

  /**
   * Closes and removes the instance if not in idsToKeep.
   * @param idsToKeep array with ids to keep E.g. ["1234", "4321"]
   */
  keepOnly(idsToKeep: string[]): T[] {
    this._instances = this._instances.filter((instance) => {
      try {
        if (idsToKeep.includes(instance._instanceIndentifier)) {
          return true;
        } else {
          instance.close();
          return false;
        }
      } catch (err) {
        return false;
      }
    });
    return this._instances;
  }

  /**
   * @inheritdoc
   */
  get instances(): T[] {
    return this._instances;
  }

  /**
   * Update instance with new information
   * If there is an instance with the instanceIndentifier equal to
   * options.instanceIndentifier, the update method will be called with
   * instanceOptions.
   * E.g. instance.update(options.instanceOptions)
   * or create new instance with constructor.
   * @param options Object with new informations
   * @return return the instance updated/created
   */
  upsert(options: U): T {
    const id = options.instanceIndentifier;
    const instance = this._instances.find(
      (classItem) => id === classItem._instanceIndentifier
    );

    if (!instance) {
      const newInstance = this.instanceConstructor(options);
      this._instances.push(newInstance);
      return newInstance;
    } else {
      instance.update(options);
      return instance;
    }
  }

  close(): void {
    for (const instance of this.instances) {
      instance.close();
    }
    this._instances = [];
  }
}
