'use strict';

const util = require('util');
const chalk = require('chalk');
const stackTrace = require('stack-trace');

const deprecated = (msgOrFn, { index = 0, debug = false } = {}) => {
    const trace = stackTrace.parse(new Error('deprecated'));
    trace.shift();

    if (debug) {
        console.log(trace);
    }

    let msgFormat = msgOrFn;
    if ('function' !== typeof msgOrFn) {
        const message = msgOrFn || '`%s` is deprecated and will be removed in some later release.';
        msgFormat = st => util.format(message, st['functionName']);
    }

    return [
        chalk.yellow(msgFormat(trace[index])),
        chalk.cyan(util.format(
            '%s:%s:%s',
            trace[index + 1]['fileName'],
            trace[index + 1]['lineNumber'],
            trace[index + 1]['columnNumber']
        ))
    ].join('\n');
};

module.exports = deprecated;
