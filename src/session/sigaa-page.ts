import { URL } from 'url';
import { decode as htmlEntitiesDecode } from 'he';

import * as http from 'http';
import { load as $load } from 'cheerio';
import { HTTPMethod } from '../sigaa-types';
import { HTTPRequestOptions } from './sigaa-http';

/**
 * @category Internal
 */
export interface SigaaPageConstructor {
  requestBody?: string | Buffer;
  body: string;
  requestOptions: HTTPRequestOptions;
  url: URL;
  headers: http.IncomingHttpHeaders;
  statusCode: number;
}

/**
 * Represents an html form.
 * @category Internal
 */
export interface SigaaForm {
  /**
   * The URL that should be used to submit this form.
   */
  action: URL;
  /**
   * List of form fields.
   */
  postValues: Record<string, string>;
}

/**
 * @category Internal
 */
export interface Page {
  /**
   * @param method Page HTTP request method. ex: POST, GET.
   */
  readonly method: HTTPMethod;

  /**
   * @param statusCode HTTP status code,
   */
  readonly statusCode: number;

  /**
   * @param url Page URL
   */
  readonly url: URL;

  /**
   * @param requestHeaders Page HTTP request headers.
   */
  readonly requestHeaders: Record<string, string>;

  /**
   * @param headers The page HTTP response headers.
   */
  readonly headers: Record<string, string[] | string | undefined>;

  /**
   *
   * @param body Response page body.
   */
  readonly body: string;

  /**
   *
   * @param bodyDecoded Page body with HTML encoded characters replaced.
   */
  readonly bodyDecoded: string;

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
   * Cheerio page.
   */
  readonly $: cheerio.Root;

  /**
   * Page request http options.
   *
   * This is the object that was passed to the node to make the request.
   */
  readonly requestOptions: HTTPRequestOptions;

  /**
   * Only if request method is POST.
   */
  readonly requestBody?: string | Buffer;

  /**
   * Extracts the javascript function JSFCLJS from the page,
   * this function on the page redirects the user to another
   * page using the POST method, often this function is in
   * the onclick attribute in some element.
   * @param javaScriptCode
   * @returns Object with URL action and POST values equivalent to function
   */
  parseJSFCLJS(javaScriptCode: string): SigaaForm;
}

/**
 * Response page of sigaa.
 * @category Internal
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

  /**
   * @inheritdoc
   */
  public readonly requestOptions: HTTPRequestOptions;

  /**
   * @inheritdoc
   */
  public readonly requestBody?: string | Buffer;

  /**
   * @inheritdoc
   */
  public readonly statusCode: number;

  /**
   * @inheritdoc
   */
  public readonly url: URL;

  /**
   * @inheritdoc
   */
  public readonly headers: Record<string, string[] | string | undefined>;

  /**
   * @inheritdoc
   */
  public readonly body: string;

  /**
   * @inheritdoc
   */
  public modifiedAt: number;

  /**
   * Current cheerio instance.
   */
  private _$?: cheerio.Root;

  /**
   * current page view state.
   **/
  private _viewState?: string;

  /**
   * Page body with HTML encoded characters replaced.
   */
  private _bodyDecoded?: string;

  /**
   * HTTP request method that originated page.
   **/
  public get method(): HTTPMethod {
    return this.requestOptions.method;
  }

  /**
   * @inheritdoc
   */
  public get bodyDecoded(): string {
    if (this._bodyDecoded) return this._bodyDecoded;
    this._bodyDecoded = htmlEntitiesDecode(this.body);
    return this._bodyDecoded;
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
      throw new Error('SIGAA: Session expired.');
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

  /**
   * @inheritdoc
   */
  parseJSFCLJS(javaScriptCode: string): SigaaForm {
    if (!javaScriptCode.includes('getElementById'))
      throw new Error('SIGAA: Form not found.');

    const formQuery = javaScriptCode.replace(
      /if([\S\s]*?)getElementById\('|'([\S\s]*?)false/gm,
      ''
    );

    const formEl = this.$(`#${formQuery}`);
    if (!formEl) {
      throw new Error('SIGAA: Form not found.');
    }

    const formAction = formEl.attr('action');
    if (formAction === undefined)
      throw new Error('SIGAA: Form without action.');

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
