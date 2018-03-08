'use strict';

const util = require('util');
const colors = require('colors/safe');
const stackTrace = require('stack-trace');

const deprecate = (message, index = 0, dubug = false) => {
    const trace = stackTrace.parse(new Error('deprecated'));
    trace.shift();

    if (dubug) {
        console.log(trace);
    }

    if ('function' === typeof message) {
        message = message(trace[index]);
    } else {
        message = util.format(
            message || '"%s" is deprecated and will be removed in v1.',
            trace[index]['functionName']
        )
    }

    message = [
        colors.yellow(message),
        '\n',
        colors.cyan(
            util.format(
                '%s:%s:%s',
                trace[index + 1]['fileName'],
                trace[index + 1]['lineNumber'],
                trace[index + 1]['columnNumber']
            )
        )
    ].join('');

    return message;
};

module.exports = deprecate;
