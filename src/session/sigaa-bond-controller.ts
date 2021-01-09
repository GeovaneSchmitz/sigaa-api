export interface BondController {
  currentBond: URL | null;
}
/**
 * Store current bond
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
