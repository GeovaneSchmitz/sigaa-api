export interface TeacherBond {
  readonly type: 'teacher';
}
/**
 * class to represent teacher bond
 */
export class SigaaTeacherBond implements TeacherBond {
  readonly type = 'teacher';
}
