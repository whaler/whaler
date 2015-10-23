'use strict';

var Table = require('cli-table');

var addCmd = function(whaler) {
    var pkg = require('./package.json');
    var console = whaler.require('./lib/console');

    whaler.cli.command(
        pkg.name + ' [action] [name] [value]'
    ).description(
        pkg.description
    ).action(function(action, name, value, options) {

        var opts = {
            action: action,
            name: name,
            value: value
        };

        whaler.events.emit('vars', opts, function(err, vars) {
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
                    table.push([v, vars[v]]);
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

    }).on('--help', function() {
        whaler.cli.argumentsHelp(this, {
            'action': '*list, set, unset',
            'name': 'Var name',
            'value': 'Var value'
        });
    });
};

module.exports = function(whaler) {

    addCmd(whaler);

    whaler.events.on('vars', function(options, callback) {
        var action = options['action'] || 'list';
        var name = options['name'] || null;

        if ('list' == action) {
            whaler.vars.find({}, function(err, docs) {
                var vars = {};
                while (docs.length) {
                    var obj = docs.shift();
                    vars[obj._id] = obj.value;
                }
                callback(null, vars);
            });
        } else {
            if (name) {

                whaler.vars.find({ _id: name }, function(err, docs) {

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
                        whaler.vars.remove({ _id: options['name'] }, {});
                        callback(null);

                    } else {

                        if (v) {
                            var update = { value: options['value'] };
                            whaler.vars.update({ _id: v['_id'] }, { $set: update }, {}, function(err) {
                                if (err) {
                                    return callback(err);
                                }
                                callback(null);
                            });

                        } else {
                            v = {
                                _id:  name,
                                value: options['value']
                            };

                            whaler.vars.insert(v, function(err, doc) {
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
