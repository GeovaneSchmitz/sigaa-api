const SigaaRequest = require('./sigaa-request')
const { JSDOM } = require('jsdom')
;('use strict')

class SigaaAccount extends SigaaRequest {
  constructor (cache) {
    super(cache)
  }
  
}

module.exports = SigaaAccount
