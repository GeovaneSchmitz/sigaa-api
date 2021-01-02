import { URL } from 'url';

import { isEqual } from 'lodash';
import { SigaaPromiseStack } from '@helpers/sigaa-promise-stack';
import {
  HTTPRequestOptions,
  ProgressCallback,
  SigaaRequestOptions
} from './sigaa-http';
import { Page, SigaaPage } from './sigaa-page';
import { PageCache } from './sigaa-page-cache';
import { Token } from './sigaa-tokens';

/**
 * Manage a http session
 */
export interface HTTPSession {
  /**
   * if returns string the download is suspended
   * @param url
   * @param sessionHttpOptions
   * @param requestBody
   */
  beforeDownloadRequest(
    url: URL,
    downloadPath: string,
    sessionHttpOptions: HTTPRequestOptions,
    bodyRequest?: string,
    callback?: ProgressCallback
  ): Promise<string | null>;

  afterDownloadRequest(
    url: URL,
    downloadPath: string,
    sessionHttpOptions: HTTPRequestOptions,
    finalPath: string,
    bodyRequest?: string,
    callback?: ProgressCallback
  ): Promise<string>;

  /**
   * it is called after a sigaa response, only if successful. Should return a page or throw an error.
   * @param page Sigaa page
   * @param options Request Options
   */
  afterSuccessfulRequest(
    page: Page,
    options?: SigaaRequestOptions
  ): Promise<Page>;

  /**
   * It is called after a error in request. You must return a page or throw an error.
   * @param page Sigaa page
   * @param options Request Options
   */
  afterUnsuccessfulRequest(
    err: Error,
    httpOptions: HTTPRequestOptions,
    body?: string | Buffer
  ): Promise<Page>;

  /**
   * Transforms a path in URL
   * @param path
   */
  getURL(path: string): URL;

  /**
   * It is called before the request, it may be useful to delay.
   * If you return a page, the answer will be the page and there will be no http request
   * If it returns null, the request will continue as normal and if you want to suspend the request, it may generate an error.
   * @param link
   * @param httpOptions
   * @param body
   * @param options
   */
  beforeRequest(
    link: URL,
    httpOptions: HTTPRequestOptions,
    body?: string | Buffer,
    options?: SigaaRequestOptions
  ): Promise<Page | null>;

  /**
   * This is called to modify the request options
   * TIP: You must at least insert the cookies.
   * @param link
   * @param httpOptions
   * @param body
   * @param options
   */
  afterHTTPOptions(
    link: URL,
    httpOptions: HTTPRequestOptions,
    body?: string | Buffer,
    options?: SigaaRequestOptions
  ): Promise<HTTPRequestOptions>;

  /**
   *  flush all cookies and cache of session
   */
  close(): void;
}

/**
 * Interface for request params
 */
export interface Request {
  httpOptions: HTTPRequestOptions;
  body?: string | Buffer;
}

/**
 * Interface to join beforeRequest and afterRequest
 */
export interface RequestPromiseTracker {
  request: Request;
  resolve(page: Page): void;
  reject(err: Error): void;
}

export class SigaaHTTPSession implements HTTPSession {
  /**
   * @param url base of all request, example: https://sigaa.ifsc.edu.br
   */
  constructor(
    public url: string,
    private token: Token,
    private pageCache: PageCache
  ) {}

  async afterDownloadRequest(
    url: URL,
    downloadPath: string,
    sessionHttpOptions: HTTPRequestOptions,
    finalPath: string
  ): Promise<string> {
    return finalPath;
  }

  async beforeDownloadRequest(): Promise<null> {
    return null;
  }

  private postRequestsStack = new SigaaPromiseStack<Request, Page>('reverse');
  private noCookieRequestsStack = new SigaaPromiseStack<Request, Page>(
    'reverse'
  );
  private requestStack = new SigaaPromiseStack<Request, Page>('reverse');

  private requestPromises: RequestPromiseTracker[] = [];

  getURL(path: string): URL {
    return new URL(path, this.url);
  }

  async afterUnsuccessfulRequest(
    err: Error,
    httpOptions: HTTPRequestOptions,
    body?: string | Buffer
  ): Promise<Page> {
    const requestPromise = this.findAndRemovePromiseRequest({
      httpOptions,
      body
    });
    if (requestPromise) {
      requestPromise.reject(err);
    }
    throw err;
  }

  private findAndRemovePromiseRequest(
    request: Request
  ): RequestPromiseTracker | null {
    const index = this.requestPromises.findIndex(
      (requestPromise) =>
        isEqual(request.httpOptions, requestPromise.request.httpOptions) &&
        requestPromise.request.body === request.body
    );
    if (index !== -1) {
      return this.requestPromises.splice(index, 1)[0];
    }
    return null;
  }

  async afterSuccessfulRequest(page: SigaaPage): Promise<Page> {
    const requestPromise = this.findAndRemovePromiseRequest({
      body: page.requestBody,
      httpOptions: page.requestOptions
    });
    const setCookie = page.headers['set-cookie'];
    if (setCookie) {
      const cookies =
        typeof setCookie === 'string' ? setCookie : setCookie.join(' ');

      const token = cookies.match(/JSESSIONID=[^;]*/g);
      if (token) {
        this.token.setToken(page.requestOptions.hostname, token[0]);
      }
    }
    if (page.statusCode === 200) {
      if (
        page.requestBody === undefined ||
        typeof page.requestBody === 'string'
      )
        this.pageCache.storePage(page);
    }

    if (requestPromise) {
      requestPromise.resolve(page);
    }

    return page;
  }

  async afterHTTPOptions(
    link: URL,
    httpOptions: HTTPRequestOptions
  ): Promise<HTTPRequestOptions> {
    const cookie = this.token.getTokenByDomain(httpOptions.hostname);
    if (cookie) {
      httpOptions.headers.Cookie = cookie;
    }
    return httpOptions;
  }

  async beforeRequest(
    url: URL,
    httpOptions: HTTPRequestOptions,
    requestBody?: string | Buffer,
    options?: SigaaRequestOptions
  ): Promise<Page | null> {
    if (!options?.noCache) {
      const page = this.pageCache.getPage(httpOptions, requestBody);
      if (page) return page;
    }

    const stack = !httpOptions.headers.Cookie
      ? this.noCookieRequestsStack
      : httpOptions.method === 'POST'
      ? this.postRequestsStack
      : this.requestStack;

    if (
      (requestBody === undefined || typeof requestBody == 'string') &&
      options?.shareSameRequest
    ) {
      const request: Request = {
        httpOptions,
        body: requestBody
      };
      const runningRequest = stack.promises.find(
        (request) =>
          request.key.body === requestBody &&
          isEqual(httpOptions, request.key.httpOptions)
      );
      if (runningRequest?.promise) {
        return runningRequest.promise;
      }
      await new Promise<void>((awaitResolve) => {
        stack.addPromise(request, () => {
          awaitResolve();
          return new Promise<Page>((resolve, reject) => {
            this.requestPromises.push({ request, reject, resolve });
          });
        });
      });
    }

    return null;
  }

  close(): void {
    this.token.clearTokens();
    this.pageCache.clearCachePage();
  }
}
