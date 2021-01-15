'use strict';

const Module = require('module');
if (!Module.prototype.import) {
    Module.prototype.import = function (id) {
        return import(Module._resolveFilename(id, this, false)).catch(err => {
            if ('ERR_UNKNOWN_FILE_EXTENSION' == err.code) {
                return Promise.resolve({ default: this.require(id) });
            }
            throw err;
        });
    };
}
