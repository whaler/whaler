'use strict';

// TODO: not needed starting from node.js v 11.14.0
if (!process.__emitWarning) {
    process.__emitWarning = process.emitWarning;
    process.emitWarning = function(warning, type, ...args) {
        if ('ExperimentalWarning' == type) {
            if ('The fs.promises API is experimental' == warning) {
                return;
            }
        }
        process.__emitWarning(warning, type, ...args);
    };
}
//require('fs.promises');

const Module = require('module');
if (!Module.prototype.import) {
    // Module.prototype.import = async function (id) {
    //     return await import(Module._resolveFilename(id, this, false)).catch(err => {
    //         if ('Not supported' == err.message) {
    //             return new Promise(_ => _({ default: this.require(id) }));
    //         }
    //         throw err;
    //     });
    // };
}
