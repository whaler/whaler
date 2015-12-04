'use strict';

var Table = require('cli-table');
var Datastore = require('nedb');

var emit = function(whaler, opts) {
    var console = whaler.require('./lib/console');

    whaler.events.emit('vars', opts, function(err, vars) {
        console.log('');
        if (err) {
            return console.error('[%s] %s', process.pid, err.message, '\n');
        }

        var action = opts['action'] || 'list';

        if ('list' == action) {
            var table = new Table({
                head: [
                    'Name',
                    'Value'
                ],
                style : {
                    head: [ 'cyan' ]
                }
            });
            for (var v in vars) {
                var value = vars[v];
                if (undefined == value) {
                    value = 'undefined';
                }
                table.push([v, value]);
            }
            console.log(table.toString(), '\n');

        } else {
            var msg = 'Unset: ' + opts['name'];
            if ('set' == action) {
                msg = 'Set: ' + opts['name'] + '=' + opts['value'];
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
            'Show vars'
        ).action(function(options) {
            emit(whaler, {
                action: 'list'
            });
        });

        cmd.command(
            'set <name> [value]'
        ).argumentsHelp({
            'name': 'Var name',
            'value': 'Var value'
        }).description(
            'Set var'
        ).action(function(name, value, options) {
            emit(whaler, {
                action: 'set',
                name: name,
                value: value
            });
        });

        cmd.command(
            'unset <name>'
        ).argumentsHelp({
            'name': 'Var name'
        }).description(
            'Unset var'
        ).action(function(name, options) {
            emit(whaler, {
                action: 'unset',
                name: name
            });
        });
    });
};

module.exports = function(whaler) {

    addCmd(whaler);

    var vars = new Datastore({
        filename: '/etc/whaler/vars.db',
        autoload: true
    });

    whaler.events.on('vars', function(options, callback) {
        var action = options['action'] || 'list';
        var name = options['name'] || null;

        if ('list' == action) {
            vars.find({}, function(err, docs) {
                var vars = {};
                while (docs.length) {
                    var obj = docs.shift();
                    vars[obj._id] = obj.value;
                }
                callback(null, vars);
            });

        } else {
            if (name) {
                vars.find({ _id: name }, function(err, docs) {
                    var v = null;
                    if (1 == docs.length && options['name'] == docs[0]['_id']) {
                        v = docs[0];
                    }

                    if ('unset' == action) {
                        if (!v) {
                            return callback(
                                new Error('An var with "' + options['name'] + '" name not found.')
                            );
                        }
                        vars.remove({ _id: options['name'] }, {});
                        callback(null);

                    } else {
                        var value = options['value'];

                        if (v) {
                            var update = { value: value };
                            vars.update({ _id: v['_id'] }, { $set: update }, {}, function(err) {
                                if (err) {
                                    return callback(err);
                                }
                                callback(null);
                            });

                        } else {
                            v = {
                                _id:  name,
                                value: value
                            };

                            vars.insert(v, function(err, doc) {
                                if (err) {
                                    return callback(err);
                                }
                                callback(null);
                            });
                        }
                    }

                });

            } else {
                return callback(
                    new Error('Var name must be defined!')
                );
            }
        }
    });
};
