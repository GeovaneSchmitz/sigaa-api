import { Parser } from '@helpers/sigaa-parser';
import { HTTP } from '@session/sigaa-http';
import { Page } from '@session/sigaa-page';

export type ConstructByElement<T> = (
  page: Page,
  element: cheerio.Element,
  period: string,
  http: HTTP,
  parser: Parser
) => T;

export interface Course {
  id: string;
  title: string;
}
