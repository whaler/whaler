'use strict';

var Q = require('q');
var Table = require('cli-table');

var addCmd = function(whaler) {
    var pkg = require('./package.json');
    var console = whaler.require('./lib/console');

    whaler.cli.command(
        pkg.name
    ).description(
        pkg.description
    ).action(function(options) {

        whaler.events.emit('list', {}, function(err, response) {
            if (err) {
                return console.error('[%s] %s', process.pid, err.message, '\n');
            }

            var table = new Table({
                head: [
                    'Application name',
                    'Status',
                    'Path'
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

    });
};

module.exports = function(whaler) {

    addCmd(whaler);

    var listContainers = Q.denodeify(whaler.docker.listContainers);
    var containerInspect = Q.denodeify(function(container, callback) {
        container.inspect(callback);
    });

    whaler.events.on('list', function(options, callback) {

        whaler.apps.all(function(err, apps) {
            var promise = Q.async(function*() {
                if (err) {
                    throw err;
                }

                var response = [];
                var keys = Object.keys(apps);

                while (keys.length) {
                    var appName = keys.shift();
                    var app = apps[appName];
                    var names = Object.keys(app.config['data']);

                    var containers = yield listContainers({
                        all: true,
                        filters: JSON.stringify({
                            name: [
                                whaler.helpers.getDockerFiltersNamePattern(appName)
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

                    var status = [];
                    while (names.length) {
                        var name = names.shift();
                        var container = whaler.docker.getContainer(name + '.' + appName);

                        var value = '~';
                        var color = app.config['data'][name] ? null : 'red';
                        try {
                            var info = yield containerInspect(container);
                            if (info['State']['Running']) {
                                value = '+';
                            } else {
                                value = '-';
                            }
                        } catch (e) {}
                        status.push(color ? value[color] : value);
                    }

                    response.push([appName, status.join('|'), app.path]);
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
