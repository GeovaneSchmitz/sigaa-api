import { Exam } from './sigaa-exam-student';

/**
 * @category Public
 */
export interface SyllabusDay {
  description: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * @category Public
 */
export interface SyllabusReference {
  type?: string;
  description: string;
}

/**
 * @category Public
 */
export interface Syllabus {
  methods?: string;
  assessmentProcedures?: string;
  attendanceSchedule?: string;
  schedule: SyllabusDay[];
  evaluations: Exam[];
  basicReferences: SyllabusReference[];
  supplementaryReferences: SyllabusReference[];
}
