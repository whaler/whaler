'use strict';

const util = require('util');

const promisify = obj => {
    return new Proxy(obj, {
        get: (target, name) => {
            if (name in target) {
                if (target[name] instanceof Function) {
                    return util.promisify(target[name]);
                }
            }
            return target[name];
        }
    });
};

module.exports = promisify;
