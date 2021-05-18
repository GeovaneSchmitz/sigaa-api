/**
 * Login Status
 * @category Public
 */
export enum LoginStatus {
  Unauthenticated,
  Authenticated
}

/**
 * @category Internal
 */
export type HTTPMethod = 'POST' | 'GET';

/**
 * Typescript macro for Without
 * @category Internal
 */
export type Without<T, U> = {
  [P in Exclude<keyof T, keyof U>]?: never;
};

/**
 * Typescript macro for XOR
 * @category Internal
 */
export type XOR<T, U> = (Without<T, U> & U) | (Without<U, T> & T);
