'use strict';

const path = require('path');
const format = require('util').format;
const cli = require('x-commander/extra');
const pkg = require('../package.json');
const deprecate = require('../lib/deprecate');

// TODO: remove in v1
const $ = require('x-node');

cli.l10n({
    'output usage information': 'Output usage information',
    'output the version number': 'Display this application version'
});

cli.deprecate = message => null;

const util = {
    /**
     * @param {String} type
     * @param {String} value
     * @returns {String}
     */
    prepare: (type, value) => {
        if ('name' == type) {
            let name = path.basename(process.cwd());
            if (process.env.WHALER_DAEMON_NAME) {
                name = process.env.WHALER_DAEMON_NAME;
            }

            return value || name;

        } else if ('ref' == type) {
            let ref = path.basename(process.cwd());
            if (process.env.WHALER_DAEMON_NAME) {
                ref = process.env.WHALER_DAEMON_NAME;
            }

            if (value) {
                const parts = value.split('.');
                if (2 == parts.length) {
                    if (!parts[1]) {
                        value += ref;
                    }
                }

                return value;
            }

            return ref;

        } else if ('path' == type) {
            value = value || process.cwd();
            if (!path.isAbsolute(value)) {
                value = path.join(process.cwd(), path.normalize(value));
            }

            return value;
        }

        return value;
    },

    /**
     * @param {Object} options
     * @param {Array} keys
     * @returns {Object}
     */
    filter: (options, keys) => {
        const result = {};
        for (let key of keys) {
            result[key] = options.hasOwnProperty(key) ? options[key] : undefined;
        }
        return result;
    }
};

/**
 * @param status
 */
cli.Command.prototype.ignoreEndLine = function(status) {
    this.__ignoreEndLine = status;
    return this;
};

cli.Command.prototype._action = cli.Command.prototype.action;
cli.Command.prototype.action = function(fn) {
    const done = err => {
        if (err) {
            console.error('\n[%s] %s\n', process.pid, err.message);
        } else if (true !== this.__ignoreEndLine) {
            console.log('');
        }
    };

    // TODO: remove in v1
    if ($.isGenerator(fn)) {
        cli.deprecate(
            deprecate(trace => '"cli.action" support for generators will be removed in v1.')
        );
        this.util = util;
        fn = fn.bind(this);
        return this._action($.async(fn, done));
    } else {
        return this._action(async (...args) => {
            let err = null;
            try {
                await fn(...args, util);
            } catch (e) {
                err = e;
            }
            done(err);
        });
    }
};

cli._name = pkg.name;

cli._printer.error = function(...args) {
    throw new Error(format.apply(null, args));
};

try {
    const dev = require('../dev.json');
    cli.version(dev.version + (dev.sha ? ' ' + dev.sha.substr(0, 7) : ''));
} catch(e) {
    cli.version(pkg.version);
}

cli.option(
    '-H, --host <HOST>',
    'Host to use'
);

cli.addUnknownCommand();

module.exports = cli;
