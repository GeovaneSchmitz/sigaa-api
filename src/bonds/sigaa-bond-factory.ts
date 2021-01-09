import { Parser } from '@helpers/sigaa-parser';
import { HTTP } from '@session/sigaa-http';
import { HTTPFactory } from '@session/sigaa-http-factory';

import { SigaaStudentBond, StudentBond } from './sigaa-student-bond';
import { SigaaTeacherBond, TeacherBond } from './sigaa-teacher-bond';

export type BondType = StudentBond | TeacherBond;
export interface BondFactory {
  createStudentBond: (
    registration: string,
    program: string,
    bondSwitchUrl: URL | null
  ) => StudentBond;

  createTeacherBond: () => TeacherBond;
}

/**
 * Class to implements Bond factory
 */
export class SigaaBondFactory implements BondFactory {
  constructor(private httpFactory: HTTPFactory, private parser: Parser) {}

  createStudentBond(
    registration: string,
    program: string,
    bondSwitchUrl: URL | null
  ): StudentBond {
    let http: HTTP;
    if (bondSwitchUrl) {
      http = this.httpFactory.createHttpWithBond(bondSwitchUrl);
    } else {
      http = this.httpFactory.createHttp();
    }
    return new SigaaStudentBond(http, this.parser, program, registration);
  }

  createTeacherBond(): TeacherBond {
    return new SigaaTeacherBond();
  }
}
