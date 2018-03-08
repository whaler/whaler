'use strict';

const fs = require('fs.promises');

if (!module.constructor.prototype.import) {
    // module.constructor.prototype.import = function (id) {
    //     return new Promise(res => res(this.require(id)));
    // };
}
