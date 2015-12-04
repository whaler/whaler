'use strict';

var pkg = require('../package.json');
var Command = require('commander').Command;

var pad = function(str, width) {
    var len = Math.max(0, width - str.length);
    return str + Array(len + 1).join(' ');
};

var indexOfHelp = function(arr) {
    var index = arr.indexOf('--help');
    if (-1 === index) {
        index = arr.indexOf('-h');
    }
    return index;
};

var argumentsHelp = function(cmd, descriptions) {
    if (cmd._args.length) {
        var width = 0;//cmd.largestOptionLength();
        cmd._args.forEach(function(arg) {
            width = Math.max(width, arg.name.length);
        });

        console.log('  Arguments:');
        console.log('');
        cmd._args.forEach(function(arg) {
            console.log('    ' + pad(arg.name, width) + '  ' + descriptions[arg.name]);
        });
        console.log('');
    }
};

// fix
Command.prototype.__optionHelp = Command.prototype.optionHelp;
Command.prototype.optionHelp = function() {
    return  this.__optionHelp().replace('output usage information', 'Output usage information');
};

Command.prototype.argumentsHelp = function(descriptions) {
    // backward compatibility
    if (arguments.length > 1) {
        argumentsHelp(arguments[0], arguments[1]);
        return;
    }

    var self = this;

    self.on('--help', function() {
        argumentsHelp(self, descriptions);
    });

    return self;
};

Command.prototype.defaultCommand = function(value) {
    this._defaultCommand = value;
};

Command.prototype.__parseOptions = Command.prototype.parseOptions;
Command.prototype.parseOptions = function(argv) {
    var parsed = this.__parseOptions(argv);

    if (this.parent) {
        if (this._hasSubCommand) {
            var index = indexOfHelp(parsed.unknown);
            if (-1 !== index) {
                this._printHelp = true;
                parsed.unknown.splice(index, 1);
            }
        } else {
            if (this.parent._printHelp) {
                parsed.unknown.push('--help');
            }
        }
    }

    return parsed;
};

Command.prototype.addUnknownCommand = function() {
    this.command(
        '*'
    ).description(
        'Unknown command'
    ).action(function(cmd) {
        console.error("  error: unknown command `%s'", cmd);
    })._noHelp = true;
};

Command.prototype.addSubCommands = function(fn) {
    if (!this._hasSubCommand) {
        this._hasSubCommand = true;
        this.allowUnknownOption(true);
        this.addUnknownCommand();

        this.action(function() {

            var args = Array.prototype.slice.call(arguments).slice(0);
            var argv = this.parent.rawArgs.slice(2);
            if (arguments.length < 2) {
                if (-1 === indexOfHelp(argv) && this._defaultCommand) {
                    var _defaultCommand = this._defaultCommand;
                    this.commands.forEach(function(command) {
                        if (command._name === _defaultCommand) {
                            args.unshift(command._name)
                            argv.push(command._name);
                        }
                    });
                }
            }

            if (args.length > 1) {
                var parsed = this.parseOptions(this.normalize(argv));
                parsed.args.unshift(this.parent._name);
                this._description = null;
                if (this.parent._printHelp) {
                    parsed.unknown.push('--help');
                }
                this.parse(parsed.args.concat(parsed.unknown));
            } else {
                this._description = null;
                this.help();
            }
        })
    }

    fn(this);

    return this;
};

var cli = new Command();

cli._name = pkg.name;
cli.version(pkg.version);
cli.options[0].description = 'Display this application version.';

cli.option(
    '-H, --host <HOST>',
    'Host to use.'
);

cli.addUnknownCommand();

module.exports = cli;
