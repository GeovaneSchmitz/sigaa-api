import { Page } from '@session/sigaa-page';
import { Request } from '@session/sigaa-http-session';
import { PromiseStack, SigaaPromiseStack } from './sigaa-promise-stack';

/**
 * Requisition stack list.
 * @category Internal
 */
export interface RequestStacks<K, T> {
  /**
   * Request without cookies (without session).
   * This stack takes precedence over the others.
   */
  noCookie: PromiseStack<K, T>;
  /**
   * Method GET.
   */
  get: PromiseStack<K, T>;
  /**
   * method POST.
   */
  post: PromiseStack<K, T>;
}

/**
 * Store request stack.
 * Serves to organize requests and avoid multiple requests at the same time,
 * if multiple requests occur at the same time, SIGAA will not respond correctly (blank pages).
 * @category Internal
 */
export interface RequestStackController<K, T> {
  /**
   * Returns RequestStacks for domain.
   * @param domain domain
   * @returns RequestStacks.
   */
  getStacksByDomain(domain: string): RequestStacks<K, T>;

  /**
   * flush all stacks.
   */
  close(): void;
}

/**
 * @category Internal
 */
export class SigaaRequestStack<K, T> implements RequestStackController<K, T> {
  private _stacks: Record<string, RequestStacks<K, T>> = {};

  private createStacks(domain: string): RequestStacks<K, T> {
    const newRequestStacks = {
      noCookie: new SigaaPromiseStack<K, T>('reverse'),
      get: new SigaaPromiseStack<K, T>('reverse'),
      post: new SigaaPromiseStack<K, T>('reverse')
    };
    this._stacks[domain] = newRequestStacks;
    return this._stacks[domain];
  }

  /**
   * @inheritdoc
   */
  getStacksByDomain(domain: string): RequestStacks<K, T> {
    return this._stacks[domain] || this.createStacks(domain);
  }

  /**
   * @inheritdoc
   */
  close(): void {
    for (const domain of Object.keys(this._stacks)) {
      this.getStacksByDomain(domain).noCookie.flush();
      this.getStacksByDomain(domain).get.flush();
      this.getStacksByDomain(domain).post.flush();
    }
    this._stacks = {};
  }
}

export const sigaaRequestStackSingleton = new SigaaRequestStack<
  Request,
  Page
>();
