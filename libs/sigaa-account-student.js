const SigaaRequest = require('./sigaa')
const { JSDOM } = require('jsdom')
;('use strict')

class SigaaAccount extends SigaaRequest {
  constructor (urlBase, cache) {
    super(urlBase, cache)
  }
  
}

module.exports = SigaaAccount
