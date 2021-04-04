/**
 * @category Public
 */
export interface Member {
  name: string;
  username: string;
  email: string;
  photoURL?: URL;
}

/**
 * @category Public
 */
export interface Teacher extends Member {
  formation?: string;
  department?: string;
}

/**
 * @category Public
 */
export interface Student extends Member {
  registration: string;
  program: string;
  registrationDate: Date;
}

/**
 * @category Public
 */
export interface MemberList {
  students: Student[];
  teachers: Teacher[];
}
