/**
 * Abstraction to represent teacher bond.
 * @TODO
 * @category Public
 **/
export interface TeacherBond {
  readonly type: 'teacher';
}

/**
 * Class to represent teacher bond. In IFSC it is called "Vínculo de professor".
 * @TODO
 * @category Internal
 */
export class SigaaTeacherBond implements TeacherBond {
  readonly type = 'teacher';
}
