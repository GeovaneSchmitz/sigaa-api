module.exports = {
  /**
   * types of users
   * STUDENT, TEACHER or UNAUTHENTICATED
   * @enum {String} UserTypes
   * @readonly
   */
  userTypes: {
    /**
     * STUDENT; If user is a student
     */
    STUDENT: 'STUDENT',
    /**
     * TEACHER; If user is a teacher
     */
    TEACHER: 'TEACHER',
    /**
     * UNAUTHENTICATED; If user is not unauthenticated
     */
    UNAUTHENTICATED: 'UNAUTHENTICATED'
  },
  /**
   * @enum {boolean} userLoginStates
   */
  userLoginStates: {
    /**
     * If user is a authenticad
     */
    AUTHENTICATED: true,
    UNAUTHENTICATED: false
  }
}
