import { Parser } from '@helpers/sigaa-parser';
import { HTTP } from '@session/sigaa-http';
import { SigaaSearchTeacher } from './sigaa-search-teacher';

export class SigaaSearch {
  constructor(private http: HTTP, private parser: Parser) {}

  teacher(): SigaaSearchTeacher {
    return new SigaaSearchTeacher(this.http, this.parser);
  }
}
