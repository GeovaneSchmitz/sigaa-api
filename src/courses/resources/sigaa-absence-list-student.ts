/**
 * @category Public
 */
export interface AbsenceDay {
  date: Date;
  numOfAbsences: number;
}

/**
 * @category Public
 */
export interface AbsenceList {
  list: AbsenceDay[];
  totalAbsences: number;
  maxAbsences: number;
}
