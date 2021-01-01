import { Page } from '@session/sigaa-page';
import { SigaaAccount } from './sigaa-account';

/**
 * class to represent teacher account
 */
export class SigaaAccountTeacher extends SigaaAccount {
  readonly userType = 'teacher';

  async verifyIfUserType(page: Page): Promise<boolean> {
    if (page.url.href.includes('docente')) return true;

    if (page.url.href.includes('/telasPosSelecaoVinculos.jsf')) {
      if (page.url.href.includes('/sigaa/verPortalDocente.do')) return true;
      return false;
    }

    if (page.url.href.includes('mobile'))
      return page.body.includes('form-portal-docente');
    return false;
  }
}
