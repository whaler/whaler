'use strict';

const path = require('path');
const chalk = require('chalk');
const commander = require('x-commander');
const deprecated = require('../lib/deprecated');
const pkg = require('../package.json');

let version = pkg.version;
try {
    const dev = require('../dev.json');
    version = dev.version + (dev.sha ? ' ' + dev.sha.substr(0, 7) : '');
} catch(e) {}

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

const outputError = (message, ignoreStartLine = false, ignoreEndLine = false) => {
    const startLine = true === ignoreStartLine ? '' : '\n';
    const endLine = true === ignoreEndLine ? '' : '\n';
    console.error(startLine + '[%s] %s' + endLine, process.pid, message);
};

class Command extends commander.Command {
    /**
     * @inheritdoc
     */
    constructor(...args) {
        super(...args);
        if (!this.parent) {
            this.addHelpCommand(false);
        }
    }

    /**
     * @inheritdoc
     */
    createCommand(...args) {
        return new Command(...args);
    }

    /**
     * @inheritdoc
     */
    action(fn) {
        return super.action(async (...args) => {
            try {
                const cmd = args.pop();
                await fn(...args, util, cmd);
                if (true !== this.__ignoreOutEndLine) {
                    console.log('');
                }
            } catch (err) {
                outputError('error: ' + (err.message || err), this.__ignoreErrStartLine, this.__ignoreErrEndLine);
                process.exit(1);
            }
        });
    }

    /**
     * @private
     */
    deprecated(message) {
        if (this.parent) {
            this.parent.deprecated(message);
        } else {
            this.emit('deprecated', message);
        }
    }

    /**
     * @deprecated
     * @param {boolean} status
     * @return {Command} `this` command for chaining
     */
    ignoreEndLine(status) {
        this.deprecated(
            deprecated(
                trace => '`cli.ignoreEndLine` is deprecated and will be removed in some later release. Use `cli.ignoreOutEndLine` instead.'
            )
        );
        return this.ignoreOutEndLine(status);
    }

    /**
     * @param {boolean} status
     * @return {Command} `this` command for chaining
     */
    ignoreOutEndLine(status) {
        this.__ignoreOutEndLine = (status === undefined) || !!status;
        return this;
    }

    /**
     * @param {boolean} status
     * @return {Command} `this` command for chaining
     */
    ignoreErrStartLine(status) {
        this.__ignoreErrStartLine = (status === undefined) || !!status;
        return this;
    }

    /**
     * @param {boolean} status
     * @return {Command} `this` command for chaining
     */
    ignoreErrEndLine(status) {
        this.__ignoreErrEndLine = (status === undefined) || !!status;
        return this;
    }
}

const cli = new Command(pkg.name);

cli.option('-H, --host <HOST>', 'Host to use');

cli.version(version, null, 'Display this application version');

cli.helpOption(null, 'Output usage information');

cli.configureHelp({
    labels: {
        usage: 'Usage:\n',
        description: 'Description:\n',
        arguments: 'Arguments:\n',
        options: 'Options:\n',
        commands: 'Commands:\n',
    },
    styles: {
        label: chalk.yellow,
        term: chalk.green,
        description: chalk.cyan,
    },
    formatParams: {
        newLineUsage: true,
        indentDescription: true,
        baseIndentWidth: 2,
        minColumnWidthForWrap: 0,
    },
    formatHelp(cmd, helper) {
        return ['', helper.renderHelpTemplate(cmd, helper), ''].join('\n');
    },
    commandDescription: cmd => {
        const description = cmd.description();
        if (typeof description === 'object') {
          return description.long || '';
        }
        return description;
    },
    subcommandDescription: cmd => {
        const description = cmd.description();
        if (typeof description === 'object') {
          return description.short || '';
        }
        return description;
    }
});

cli.configureOutput({
    outputError: (message, write) => {
        outputError(message.trim());
    }
});

module.exports = cli;
