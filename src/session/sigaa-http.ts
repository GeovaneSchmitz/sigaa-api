import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import * as stream from 'stream';
import FormData from 'formdata-node/type/FormData';
import { URL } from 'url';
import { request as HTTPRequest, RequestOptions } from 'https';
import { createBrotliDecompress, createGunzip, createInflate } from 'zlib';
import { stringify } from 'querystring';
import { HTTPMethod } from '../sigaa-types';
import { HTTPSession } from './http-session';
import { Page, SigaaPage } from './sigaa-page';

export type ProgressCallback = (
  totalSize: number,
  downloadedSize?: number
) => void;

export interface SigaaRequestOptions {
  mobile?: boolean;
  noCache?: boolean;
  shareSameRequest?: boolean;
}

export interface HTTPRequestOptions extends RequestOptions {
  hostname: string;
  method: HTTPMethod;
  headers: Record<string, string>;
}

export interface HTTPResponse {
  bodyStream: NodeJS.ReadableStream;
  headers: http.IncomingHttpHeaders;
  statusCode: number;
}

export interface HTTP {
  /**
   * Make a POST multipart request
   * @async
   * @param path The path of request or full URL
   * @param formData instance of FormData
   */
  postMultipart(
    path: string,
    formData: FormData,
    options?: SigaaRequestOptions
  ): Promise<Page>;

  /**
   * Make a POST request
   * @async
   * @param path The path of request or full URL
   * @param postValues Post values in format, key as field name, and value as field value.
   * @param [options]
   * @param [options.mobile] Use mobile User-Agent
   * @param [options.noCache] If can retrieve from cache
   */
  post(
    path: string,
    postValues: Record<string, string>,
    options?: SigaaRequestOptions
  ): Promise<Page>;

  /**
   * Make a GET request
   * @async
   * @param path The path of request or full URL
   * @param [options]
   * @param [options.noCache] If can retrieve from cache
   * @param [options.mobile] Use mobile User-Agent
   */
  get(path: string, options?: SigaaRequestOptions): Promise<Page>;

  /**
   * Download a file
   * @param urlPath file url
   * @param basepath path to save file
   * @param callback callback to view download progress
   */
  downloadFileByGet(
    urlPath: string,
    basepath: string,
    callback?: ProgressCallback
  ): Promise<string>;

  /**
   * Download a file
   * @param urlPath file url
   * @param basepath path to save file
   * @param callback callback to view download progress
   */
  downloadFileByPost(
    urlPath: string,
    postValues: Record<string, string>,
    basepath: string,
    callback?: ProgressCallback
  ): Promise<string>;

  /**
   * Follow the redirect while the page response redirects to another page
   * @param page
   * @returns The last page of redirects
   */
  followAllRedirect(page: Page): Promise<Page>;

  /**
   * Close http session
   */
  closeSession(): void;
}

/**
 * HTTP request class
 * @param sigaaSession A instance of SigaaSession
 * @private
 */
export class SigaaHTTP implements HTTP {
  constructor(private session: HTTPSession) {}

  async downloadFileByGet(
    urlPath: string,
    basepath: string,
    callback?: ProgressCallback
  ): Promise<string> {
    const url = this.session.getURL(urlPath);
    const httpOptions = this.getRequestBasicOptions('GET', url);
    return this.downloadFile(url, basepath, httpOptions, undefined, callback);
  }

  downloadFileByPost(
    urlPath: string,
    postValues: Record<string, string>,
    basepath: string,
    callback?: ProgressCallback
  ): Promise<string> {
    const url = this.session.getURL(urlPath);
    const { httpOptions, body } = this.encodePostValue(url, postValues);
    return this.downloadFile(url, basepath, httpOptions, body, callback);
  }

  private async downloadFile(
    url: URL,
    basepath: string,
    httpOptions: HTTPRequestOptions,
    body?: string,
    callback?: ProgressCallback
  ): Promise<string> {
    const sessionHttpOptions = await this.session.afterHTTPOptions(
      url,
      httpOptions
    );

    const fileStats = await fs.promises.lstat(basepath);
    if (!(fileStats.isDirectory() || fileStats.isFile())) {
      throw new Error('SIGAA: Download basepath not exists.');
    }

    const suspendRequest = await this.session.beforeDownloadRequest(
      url,
      basepath,
      sessionHttpOptions,
      body,
      callback
    );
    if (suspendRequest) return suspendRequest;

    const { bodyStream, headers, statusCode } = await this.requestHTTP(
      httpOptions,
      body
    );

    if (statusCode === 302) throw new Error('SIGAA: Download expired.');

    if (statusCode !== 200)
      throw new Error('SIGAA: Invalid status code at download file page.');

    let filepath: string;
    if (fileStats.isDirectory()) {
      if (headers['content-disposition']) {
        const filename = headers['content-disposition']
          .replace(/([\S\s]*?)filename="/gm, '')
          .slice(0, -1);
        filepath = path.join(basepath, filename);
      } else {
        throw new Error('SIGAA: Invalid response at download file page.');
      }
    } else {
      filepath = basepath;
    }

    const file = fs.createWriteStream(filepath);
    bodyStream.pipe(file); // save to file

    if (callback) {
      bodyStream.on('data', () => {
        callback(file.bytesWritten);
      });
    }

    const finalPath = await new Promise<string>((resolve, reject) => {
      file.on('finish', () => {
        file.close(); // close() is sync, call resolve after close completes.
        resolve(filepath);
      });

      bodyStream.on('error', (err) => {
        file.close();
        fs.promises.unlink(filepath);
        reject(err);
      });

      file.on('error', (err) => {
        file.close();
        fs.unlinkSync(filepath);
        reject(err);
      });
    });
    return this.session.afterDownloadRequest(
      url,
      basepath,
      sessionHttpOptions,
      finalPath,
      body,
      callback
    );
  }

  closeSession(): void {
    this.session.close();
  }
  /**
   * Create object Options for https.request
   * @param method HTTP method POST or GET
   * @param link URL of Request
   * @param options
   * @param [options.withoutCookies=true] Disable cookies in headers, default = true
   * @param [options.mobile=false] Use mobile User-Agent
   * @returns The basic options for request
   * @private
   */
  private getRequestBasicOptions(
    method: HTTPMethod,
    link: URL,
    additionalHeaders?: Record<string, string>,
    options: SigaaRequestOptions = {
      mobile: false
    }
  ): HTTPRequestOptions {
    const basicOptions: HTTPRequestOptions = {
      hostname: link.hostname,
      port: 443,
      path: link.pathname + link.search,
      method: method,
      headers: {
        'User-Agent': `SIGAA-Api/1.0 (${
          options.mobile ? 'Android 7.0; ' : ''
        }https://github.com/GeovaneSchmitz/sigaa-api)`,
        'Accept-Encoding': 'br, gzip, deflate',
        Accept: '*/*',
        'Cache-Control': 'max-age=0',
        DNT: '1',
        ...additionalHeaders
      }
    };

    return basicOptions;
  }

  public async postMultipart(
    path: string,
    formData: FormData,
    options?: SigaaRequestOptions
  ): Promise<Page> {
    const url = this.session.getURL(path);
    const httpOptions = this.getRequestBasicOptions(
      'POST',
      url,
      formData.headers,
      options
    );

    const buffer = await this.convertReadebleToBuffer(formData.stream);
    return this.requestPage(url, httpOptions, buffer);
  }
  /**
   * Convert stream.Readable to buffer
   * @param stream readable stream
   * @return {Promise<Buffer>}
   * @async
   */
  private convertReadebleToBuffer(
    stream: NodeJS.ReadableStream
  ): Promise<Buffer> {
    const buffers: Uint8Array[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (buffer: Uint8Array) => {
        buffers.push(buffer);
      });

      stream.on('close', () => {
        const buffer = Buffer.concat(buffers);
        resolve(buffer);
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * RFC 3986
   * Uses the UTF-8 code point to code, not the hexadecimal binary
   * @param str
   * @returns
   */
  private encodeWithRFC3986(str: string): string {
    let escapedString = '';
    const unreservedCharacters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~';
    for (let i = 0; i < str.length; i++) {
      if (unreservedCharacters.includes(str.charAt(i))) {
        escapedString += str.charAt(i);
      } else {
        const codePoint = str.codePointAt(i);
        if (codePoint === undefined) throw new Error('Invalid code point');
        codePoint.toString(16).replace(/..?/g, '%$&');
        escapedString += codePoint.toString(16).replace(/..?/g, '%$&');
      }
    }
    return escapedString;
  }

  public async post(
    path: string,
    postValues: Record<string, string>,
    options: SigaaRequestOptions = {}
  ): Promise<Page> {
    const url = this.session.getURL(path);

    const { httpOptions, body } = this.encodePostValue(
      url,
      postValues,
      options
    );
    return this.requestPage(url, httpOptions, body, options);
  }

  /**
   * Generate body and headers for post request
   * @param postValues
   * @param url
   * @param options
   */
  private encodePostValue(
    url: URL,
    postValues: Record<string, string>,
    options?: SigaaRequestOptions
  ) {
    const body = stringify(postValues, '&', '=', {
      encodeURIComponent: this.encodeWithRFC3986
    });

    const httpOptions = this.getRequestBasicOptions(
      'POST',
      url,
      {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body).toString(10)
      },
      options
    );
    return { httpOptions, body };
  }

  public async get(path: string, options?: SigaaRequestOptions): Promise<Page> {
    const url = this.session.getURL(path);
    const httpOptions = this.getRequestBasicOptions(
      'GET',
      url,
      undefined,
      options
    );
    return this.requestPage(url, httpOptions, undefined, options);
  }

  /**
   * Make a HTTP request for a page
   * @async
   * @param url url of request
   * @param options http.request options
   * @param [requestBody] body of request
   * @returns
   */
  private async requestPage(
    url: URL,
    httpOptions: HTTPRequestOptions,
    requestBody?: string | Buffer,
    options?: SigaaRequestOptions
  ): Promise<Page> {
    try {
      const sessionHttpOptions = await this.session.afterHTTPOptions(
        url,
        httpOptions,
        requestBody,
        options
      );
      const pageBeforeRequest = await this.session.beforeRequest(
        url,
        sessionHttpOptions,
        requestBody,
        options
      );
      if (pageBeforeRequest) {
        return this.session.afterSuccessfulRequest(pageBeforeRequest, options);
      }

      const { bodyStream, headers, statusCode } = await this.requestHTTP(
        httpOptions,
        requestBody
      );

      const bodyBuffer = await this.convertReadebleToBuffer(bodyStream);

      const page = new SigaaPage({
        requestOptions: httpOptions,
        body: bodyBuffer.toString(),
        url,
        headers,
        statusCode,
        requestBody
      });
      return this.session.afterSuccessfulRequest(page, options);
    } catch (err) {
      return this.session.afterUnsuccessfulRequest(
        err,
        httpOptions,
        requestBody
      );
    }
  }

  /**
   * Make a HTTP request
   * @async
   * @param optionsHTTP http.request options
   * @param [body] body of request
   */
  protected async requestHTTP(
    optionsHTTP: HTTPRequestOptions,
    body?: string | Buffer
  ): Promise<HTTPResponse> {
    return new Promise((resolve, reject) => {
      const req = HTTPRequest(optionsHTTP, (response) => {
        resolve(this.parserResponse(response));
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (body) req.write(body);
      req.end();
    });
  }

  protected parserResponse(
    response: http.IncomingMessage
  ): Promise<HTTPResponse> {
    return new Promise((resolve, reject) => {
      let streamDecompressed: stream.Transform | undefined = undefined;
      switch (response.headers['content-encoding']) {
        case 'br':
          streamDecompressed = createBrotliDecompress();
          response.pipe(streamDecompressed);
          break;
        case 'gzip':
          streamDecompressed = createGunzip();
          response.pipe(streamDecompressed);
          break;
        case 'deflate':
          streamDecompressed = createInflate();
          response.pipe(streamDecompressed);
          break;
      }
      response.on('error', (err) => {
        if (streamDecompressed) {
          streamDecompressed.end();
        }
        reject(err);
      });
      response.on('close', () => {
        if (streamDecompressed) {
          streamDecompressed.end();
        }
      });
      if (Array.isArray(response.headers.location)) {
        response.headers.location = response.headers.location[0];
      }
      resolve({
        bodyStream: streamDecompressed ? streamDecompressed : response,
        headers: response.headers,
        statusCode: response.statusCode as number
      });
    });
  }

  public async followAllRedirect(page: Page): Promise<Page> {
    while (page.headers.location) {
      page = await this.get(page.headers.location as string);
    }
    return page;
  }
}
