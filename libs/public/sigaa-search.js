const SigaaBase = require('../common/sigaa-base')
const SigaaSearchTeacher = require('../public/sigaa-search-teacher')

class SigaaSearch extends SigaaBase {
  teacher () {
    return new SigaaSearchTeacher(this._sigaaSession)
  }
}

module.exports = SigaaSearch
