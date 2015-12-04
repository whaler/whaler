'use strict';

var Q = require('q');

var addCmd = function(whaler) {
    var pkg = require('./package.json');
    var console = whaler.require('./lib/console');

    whaler.cli.command(
        pkg.name + ' [ref]'
    ).argumentsHelp({
        'ref': 'Application or container name'
    }).description(
        pkg.description
    ).action(function(ref, options) {

        whaler.events.emit('stop', {
            ref: ref
        }, function(err, containers) {
            if (err) {
                console.log('');
                return console.error('[%s] %s', process.pid, err.message, '\n');
            }
        });

    });
};

module.exports = function(whaler) {

    addCmd(whaler);

    var console = whaler.require('./lib/console');

    var listContainers = Q.denodeify(whaler.docker.listContainers);
    var containerInspect = Q.denodeify(function(container, callback) {
        container.inspect(callback);
    });
    var containerStop = Q.denodeify(function(container, opts, callback) {
        container.stop(opts, callback);
    });

    whaler.events.on('stop', function(options, callback) {
        options['ref'] = whaler.helpers.getRef(options['ref']);

        var appName = options['ref'];
        var containerName = null;

        var parts = options['ref'].split('.');
        if (2 == parts.length) {
            appName = parts[1];
            containerName = parts[0];
        }

        whaler.apps.get(appName, function(err, app) {
            var promise = Q.async(function*() {
                if (err) {
                    throw err;
                }

                var names = [];

                if (containerName) {
                    names.push(containerName);
                } else {
                    var containers = yield listContainers({
                        all: false,
                        filters: JSON.stringify({
                            name: [
                                whaler.helpers.getDockerFiltersNamePattern(appName)
                            ]
                        })
                    });

                    while (containers.length) {
                        var data = containers.shift();
                        var parts = data['Names'][0].substr(1).split('.');
                        names.push(parts[0]);
                    }
                }

                var containers = {};
                while (names.length) {
                    var name = names.shift();
                    var container = whaler.docker.getContainer(name + '.' + appName);

                    var info = yield containerInspect(container);

                    if (!info['State']['Running']) {
                        console.warn('[%s] Container "%s.%s" already stopped.', process.pid, name, appName, '\n');

                    } else {
                        console.info('[%s] Stopping "%s.%s" container.', process.pid, name, appName, '\n');

                        var data = yield containerStop(container, {});

                        console.info('[%s] Container "%s.%s" stopped.', process.pid, name, appName, '\n');
                    }

                    containers[name] = container;
                }

                return containers;
            })();

            promise.done(function(containers) {
                callback(null, containers);
            }, function(err) {
                callback(err);
            });
        });
    });
};
