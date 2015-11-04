'use strict';

var Q = require('q');
var Table = require('cli-table');

var addCmd = function(whaler) {
    var pkg = require('./package.json');
    var console = whaler.require('./lib/console');

    whaler.cli.command(
        pkg.name + ' [name]'
    ).description(
        pkg.description
    ).action(function(name, options) {

        whaler.events.emit('status', {
            name: name
        }, function(err, response) {
            console.log('');
            if (err) {
                return console.error('[%s] %s', process.pid, err.message, '\n');
            }

            var table = new Table({
                head: [
                    'Container name',
                    'Status',
                    'IP'
                ],
                style : {
                    head: [ 'cyan' ]
                }
            });
            while (response.length) {
                var data = response.shift();
                table.push(data);
            }
            console.log(table.toString(), '\n');
        });

    }).on('--help', function() {
        whaler.cli.argumentsHelp(this, {
            'name': 'Application name'
        });
    });
};

module.exports = function(whaler) {

    addCmd(whaler);

    var listContainers = Q.denodeify(whaler.docker.listContainers);
    var containerInspect = Q.denodeify(function(container, callback) {
        container.inspect(callback);
    });

    whaler.events.on('status', function(options, callback) {
        options['name'] = whaler.helpers.getName(options['name']);

        whaler.apps.get(options['name'], function(err, app) {
            var promise = Q.async(function*() {
                if (err) {
                    throw err;
                }

                var response = [];
                var names = Object.keys(app.config['data']);

                var containers = yield listContainers({
                    all: true,
                    filters: JSON.stringify({
                        name: [
                            whaler.helpers.getDockerFiltersNamePattern(options['name'])
                        ]
                    })
                });

                while (containers.length) {
                    var data = containers.shift();
                    var parts = data['Names'][0].substr(1).split('.');
                    if (-1 == names.indexOf(parts[0])) {
                        names.push(parts[0]);
                    }
                }

                while (names.length) {
                    var name = names.shift();
                    var container = whaler.docker.getContainer(name + '.' + options['name']);

                    var ip = '-';
                    var status = 'NOT CREATED';
                    var color = app.config['data'][name] ? null : 'red';

                    try {
                        var info = yield containerInspect(container);
                        if (info['State']['Running']) {
                            status = 'ON';
                            ip = info['NetworkSettings']['IPAddress'];
                        } else {
                            status = 'OFF';
                        }
                    } catch (e) {}

                    var appName = name + '.' + options['name'];
                    response.push([
                        color ? appName[color] : appName,
                        status,
                        ip
                    ]);
                }

                return response;
            })();

            promise.done(function(response) {
                callback(null, [response]);
            }, function(err) {
                callback(err);
            });
        });
    });
};
