/**
 * Interface that abstracts the class that stores the current bond.
 * @category Internal
 */
export interface BondController {
  currentBond: URL | null;
}

/**
 * Class to store current bond.
 * @category Internal
 */
export class SigaaBondController implements BondController {
  private _currentBond: URL | null = null;

  set currentBond(value: URL | null) {
    this._currentBond = value;
  }
  get currentBond(): URL | null {
    return this._currentBond;
  }
}
