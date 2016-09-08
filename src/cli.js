'use strict';

var path = require('path');
var cli = require('x-commander/extra');
var pkg = require('../package.json');
var console = require('x-console');

cli.l10n({
    'Usage:': 'Usage:' + '\n\n   ',
    'output usage information': 'Output usage information',
    'output the version number': 'Display this application version'
});

cli.Command.prototype.util = {
    /**
     * @param {String} type
     * @param {String} value
     * @returns {String}
     */
    prepare: function(type, value) {
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
    }
};

/**
 * @param status
 */
cli.Command.prototype.ignoreEndLine = function(status) {
    this.__ignoreEndLine = status;
};

cli.Command.prototype._action = cli.Command.prototype.action;
cli.Command.prototype.action = function(fn) {
    if (fn.$isGenerator()) {
        fn = fn.bind(this);
        return this._action(
            fn.$async((err) => {
                if (err) {
                    console.error('');
                    console.error('[%s] %s', process.pid, err.message);
                    console.error('');
                } else if (true !== this.__ignoreEndLine) {
                    console.log('');
                }
            })
        );
    } else {
        return this._action(fn);
    }
};

cli._name = pkg.name;
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
