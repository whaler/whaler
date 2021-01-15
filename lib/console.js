'use strict';

const chalk = require('chalk');

Object.entries({
    info: chalk.blue,
    warn: chalk.yellow,
    error: chalk.red
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
