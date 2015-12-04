'use strict';

var Table = require('cli-table');

var emit = function(whaler, opts) {
    var console = whaler.require('./lib/console');

    whaler.events.emit('plugins', opts, function(err, data) {
        console.log('');
        if (err) {
            return console.error('[%s] %s', process.pid, err.message, '\n');
        }

        var action = opts['action'] || 'list';

        if ('list' == action) {
            var table = new Table({
                head: [
                    'Plugin name'
                ],
                style : {
                    head: [ 'cyan' ]
                }
            });
            while (data.length) {
                var name = data.shift();
                table.push([name]);
            }
            console.log(table.toString(), '\n');

        } else {
            var msg = 'Plugin ' + opts['name'] + ' removed.';
            if ('install' == action) {
                msg = 'Plugin ' + data['name'] + ' installed.';
            }
            console.info('[%s] %s', process.pid, msg, '\n');
        }
    });
};

var addCmd = function(whaler) {
    var pkg = require('./package.json');

    whaler.cli.command(
        pkg.name
    ).description(
        pkg.description
    ).addSubCommands(function(cmd) {
        cmd.defaultCommand('list');

        cmd.command(
            'list'
        ).description(
            'Show installed plugins'
        ).action(function(options) {
            emit(whaler, {
                action: 'list'
            });
        });

        cmd.command(
            'install <name>'
        ).argumentsHelp({
            'name': 'Plugin name or path'
        }).description(
            'Install plugin'
        ).action(function(name, options) {
            emit(whaler, {
                action: 'install',
                name: name
            });
        });

        cmd.command(
            'remove <name>'
        ).argumentsHelp({
            'name': 'Plugin name'
        }).description(
            'Remove plugin'
        ).action(function(name, options) {
            emit(whaler, {
                action: 'remove',
                name: name
            });
        });
    });
};

module.exports = function(whaler) {

    addCmd(whaler);

    whaler.events.on('plugins', function(options, callback) {
        var action = options['action'] || 'list';
        var name = options['name'] || null;

        if ('list' == action) {
            whaler.plugins[action](function(err, data) {
                if (err) {
                    return callback(err);
                }
                return callback(null, data);
            });
        } else {
            if (name) {
                whaler.plugins[action](name, function(err, data) {
                    if (err) {
                        return callback(err);
                    }
                    return callback(null, data);
                });

            } else {
                return callback(
                    new Error('Plugin name must be defined!')
                );
            }
        }
    });
};
