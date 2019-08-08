'use strict';

const colors = require('colors/safe');

Object.entries({
    info: colors.blue,
    warn: colors.yellow,
    error: colors.red
}).map(([method, color]) => {
    const _ = global.console[method];
    global.console[method] = (...args) => {
        if (args.length) {
            let msg = args.shift();
            if ('string' == typeof msg) {
                msg = color(msg);
            }
            args.unshift(msg);
        }
        _(...args);
    };
});
