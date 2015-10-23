'use strict';

var pkg = require('../package.json');
var Command = require('commander').Command;

// fix
Command.prototype.__optionHelp = Command.prototype.optionHelp;
Command.prototype.optionHelp = function() {
    return  this.__optionHelp().replace('output usage information', 'Output usage information');
};

var cli = new Command();

var pad = function(str, width) {
  var len = Math.max(0, width - str.length);
  return str + Array(len + 1).join(' ');
};

cli.argumentsHelp = function(cmd, descriptions) {
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

cli._name = pkg.name;
cli.version(pkg.version);
cli.options[0].description = 'Display this application version.';

cli.option(
    '-H, --host <HOST>',
    'Host to use.'
);

cli.command(
    '*'
).description(
    'Unknown command'
).action(function(cmd) {
    console.error("  error: unknown command `%s'", cmd);
})._noHelp = true;

module.exports = cli;
