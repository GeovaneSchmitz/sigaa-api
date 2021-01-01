import { URL } from 'url';

import * as http from 'http';
import { load as $load } from 'cheerio';
import { HTTPMethod } from '../sigaa-types';
import { HTTPRequestOptions } from './sigaa-http';

export interface SigaaPageConstructor {
  requestBody?: string | Buffer;
  body: string;
  requestOptions: HTTPRequestOptions;
  url: URL;
  headers: http.IncomingHttpHeaders;
  statusCode: number;
}

export interface SigaaForm {
  action: URL;
  postValues: Record<string, string>;
}

export interface Page {
  /**
   * @param method Page HTTP request method. ex: POST, GET
   */
  readonly method: HTTPMethod;

  /**
   * @param statusCode HTTP status code
   */
  readonly statusCode: number;

  /**
   * @param url Page URL
   */
  readonly url: URL;

  /**
   * @param requestHeaders Page HTTP request Headers
   */
  readonly requestHeaders: Record<string, string>;

  /**
   * @param headers The page HTTP response Headers
   */
  readonly headers: Record<string, string[] | string | undefined>;

  /**
   *
   * @param body Page body of response
   */
  readonly body: string;

  /**
   *
   * @param modifiedAt Timestamp of the last request using the page's viewState
   */
  modifiedAt: number;

  /**
   * @param viewState Page viewState is the value of the forms 'javax.faces.ViewState' field.
   */

  readonly viewState?: string;
  /**
   * Cheerio page
   */
  readonly $: cheerio.Root;

  readonly requestOptions: HTTPRequestOptions;

  readonly requestBody?: string | Buffer;

  /**
   * Extracts the javascript function JSFCLJS from the page,
   * this function on the page redirects the user to another
   * page using the POST method, often this function is in
   * the onclick attribute on a page element.
   * @param javaScriptCode
   * @returns Object with URL action and POST values equivalent to function
   */
  parseJSFCLJS(javaScriptCode: string): SigaaForm;
}

/**
 * response page of sigaa
 * @class SigaaPage
 * @private
 */
export class SigaaPage implements Page {
  constructor(options: SigaaPageConstructor) {
    this.requestOptions = options.requestOptions;
    this.requestBody = options.requestBody;
    this.body = options.body;
    this.url = options.url;
    this.headers = options.headers;
    this.statusCode = options.statusCode;
    this.modifiedAt = Date.now();

    this.checkPageStatusCodeAndExpired();
  }

  public readonly requestOptions: HTTPRequestOptions;
  public readonly requestBody?: string | Buffer;

  public readonly statusCode: number;
  public readonly url: URL;
  public readonly headers: Record<string, string[] | string | undefined>;
  public readonly body: string;
  public modifiedAt: number;
  private _$?: cheerio.Root;
  private _viewState?: string;

  public get method(): HTTPMethod {
    return this.requestOptions.method;
  }

  public get $(): cheerio.Root {
    if (this._$ === undefined) {
      this._$ = $load(this.body, {
        normalizeWhitespace: true
      });
    }
    return this._$;
  }

  public get requestHeaders(): Record<string, string> {
    return this.requestOptions.headers;
  }

  /**
   * Verify if session is expired
   */
  private checkPageStatusCodeAndExpired() {
    if (
      this.statusCode === 302 &&
      this.headers.location?.includes('/sigaa/expirada.jsp')
    )
      throw new Error('SIGAA session expired');
  }

  /**
   * Page viewstate
   */
  get viewState(): string | undefined {
    if (this._viewState === undefined) {
      const responseViewStateEl = this.$("input[name='javax.faces.ViewState']");
      if (responseViewStateEl) {
        this._viewState = responseViewStateEl.val();
      }
    }
    return this._viewState;
  }

  parseJSFCLJS(javaScriptCode: string): SigaaForm {
    if (!javaScriptCode.includes('getElementById'))
      throw new Error('SIGAA form not found');

    const formQuery = javaScriptCode.replace(
      /if([\S\s]*?)getElementById\('|'([\S\s]*?)false/gm,
      ''
    );

    const formEl = this.$(`#${formQuery}`);
    if (!formEl) {
      throw new Error('SIGAA form not found');
    }

    const formAction = formEl.attr('action');
    if (formAction === undefined) throw new Error('SIGAA form without action');

    const action = new URL(formAction, this.url);
    const postValues: Record<string, string> = {};

    formEl.find("input:not([type='submit'])").each((_, element) => {
      const name = this.$(element).attr('name');
      const value = this.$(element).val();
      if (name !== undefined) {
        postValues[name] = value;
      }
    });

    const postValuesString = `{${javaScriptCode
      .replace(/if([\S\s]*?),{|},([\S\s]*?)false/gm, '')
      .replace(/"/gm, '\\"')
      .replace(/'/gm, '"')}}`;

    return {
      action,
      postValues: {
        ...postValues,
        ...JSON.parse(postValuesString)
      }
    };
  }
}
