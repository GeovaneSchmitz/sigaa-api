/**
 * @category Public
 */
export interface Grade {
  name: string;
  value?: number;
}

/**
 * @category Public
 */
export interface SubGrade extends Grade {
  code: string;
}

/**
 * @category Public
 */
export interface SubGradeSumOfGrades extends SubGrade {
  maxValue: number;
}

/**
 * @category Public
 */
export interface SubGradeWeightedAverage extends SubGrade {
  weight: number;
}

/**
 * @category Public
 */
export interface GradeGroupOnlyAverage extends Grade {
  type: 'only-average';
}

/**
 * @category Public
 */
export interface GradeGroupWeightedAverage extends Grade {
  grades: SubGradeWeightedAverage[];
  type: 'weighted-average';
}

/**
 * @category Public
 */
export interface GradeGroupSumOfGrades extends Grade {
  grades: SubGradeSumOfGrades[];
  type: 'sum-of-grades';
}

/**
 * @category Public
 */
export type GradeGroup =
  | GradeGroupSumOfGrades
  | GradeGroupOnlyAverage
  | GradeGroupWeightedAverage;
