import { FormData } from 'formdata-node';
import { Page } from './sigaa-page';
import { HTTP, ProgressCallback, SigaaRequestOptions } from './sigaa-http';
import { BondController } from './sigaa-bond-controller';
import { PageCacheWithBond } from './sigaa-page-cache-with-bond';

/**
 * Implements sigaa bond in HTTP request class.
 *
 * @param http http instamce implementation
 * @param bondController A instance of BondController to read current bond
 * @param bondSwitchUrl url to switch bond
 *
 * @category Internal
 */
export class SigaaHTTPWithBond implements HTTP {
  constructor(
    private http: HTTP,
    private bondController: BondController,
    private pageCacheWithBond: PageCacheWithBond,
    private bondSwitchUrl: URL | null
  ) {}

  /**
   * Verify if current bond is correct.
   * Otherwise, switch bond
   */
  private async verifyIfBondIsCorrect(): Promise<void> {
    if (this.bondSwitchUrl !== this.bondController.currentBond) {
      this.pageCacheWithBond.setCurrentBond(this.bondSwitchUrl?.href || null);
      return this.switchBond();
    }
  }

  /**
   * Switch bond
   */
  private async switchBond(): Promise<void> {
    if (this.bondSwitchUrl) {
      const page = await this.http.get(this.bondSwitchUrl.href);
      const finalPage = await this.http.followAllRedirect(page);
      if (finalPage.statusCode !== 200)
        throw new Error('SIGAA: Could not switch bond.');
      this.bondController.currentBond = this.bondSwitchUrl;
    }
  }

  /**
   * @inheritdoc
   */
  async postMultipart(
    path: string,
    formData: FormData,
    options?: SigaaRequestOptions
  ): Promise<Page> {
    await this.verifyIfBondIsCorrect();
    return this.http.postMultipart(path, formData, options);
  }

  /**
   * @inheritdoc
   */
  async post(
    path: string,
    postValues: Record<string, string>,
    options?: SigaaRequestOptions
  ): Promise<Page> {
    await this.verifyIfBondIsCorrect();
    return this.http.post(path, postValues, options);
  }

  async get(path: string, options?: SigaaRequestOptions): Promise<Page> {
    await this.verifyIfBondIsCorrect();
    return this.http.get(path, options);
  }

  /**
   * @inheritdoc
   */
  async downloadFileByGet(
    urlPath: string,
    basepath: string,
    callback?: ProgressCallback
  ): Promise<string> {
    await this.verifyIfBondIsCorrect();
    return this.http.downloadFileByGet(urlPath, basepath, callback);
  }

  /**
   * @inheritdoc
   */
  async downloadFileByPost(
    urlPath: string,
    postValues: Record<string, string>,
    basepath: string,
    callback?: ProgressCallback
  ): Promise<string> {
    await this.verifyIfBondIsCorrect();
    return this.http.downloadFileByPost(
      urlPath,
      postValues,
      basepath,
      callback
    );
  }

  /**
   * @inheritdoc
   */
  async followAllRedirect(
    page: Page,
    options?: SigaaRequestOptions
  ): Promise<Page> {
    await this.verifyIfBondIsCorrect();
    return this.http.followAllRedirect(page, options);
  }

  /**
   * @inheritdoc
   */
  closeSession(): void {
    this.http.closeSession();
  }
}
