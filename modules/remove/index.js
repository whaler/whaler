'use strict';

var Q = require('q');
var fs = require('fs');

var deleteFolderRecursive = function(path) {
    if(fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function(file, index) {
            var curPath = path + '/' + file;
            if(fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

var addCmd = function(whaler) {
    var pkg = require('./package.json');
    var console = whaler.require('./lib/console');

    whaler.cli.command(
        pkg.name + ' [ref]'
    ).description(
        pkg.description
    ).option(
        '--purge',
        'Remove application'
    ).action(function(ref, options) {

        whaler.events.emit('remove', {
            ref: ref,
            purge: options.purge
        }, function(err) {
            if (err) {
                console.log('');
                return console.error('[%s] %s', process.pid, err.message, '\n');
            }
        });

    }).on('--help', function() {
        whaler.cli.argumentsHelp(this, {
            'ref': 'Application or container name'
        });
    });
};

module.exports = function(whaler) {

    addCmd(whaler);

    var console = whaler.require('./lib/console');

    var listContainers = Q.denodeify(whaler.docker.listContainers);
    var containerRemove = Q.denodeify(function(container, opts, callback) {
        container.remove(opts, callback);
    });

    whaler.events.on('remove', function(options, callback) {
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
                        names.push(parts[0]);
                    }
                }

                while (names.length) {
                    var name = names.shift();
                    var container = whaler.docker.getContainer(name + '.' + appName);

                    console.info('[%s] Removing "%s.%s" container.', process.pid, name, appName, '\n');

                    yield containerRemove(container, {
                        v: true,
                        force: true
                    });

                    console.info('[%s] Container "%s.%s" removed.', process.pid, name, appName, '\n');
                }

                if (!containerName && options['purge']) {
                    whaler.apps.remove(appName);

                    deleteFolderRecursive('/var/lib/whaler/volumes/' + appName);

                    console.warn('[%s] Application "%s" removed.', process.pid, appName, '\n');
                }

            })();

            promise.done(function() {
                callback(null);

            }, function(err) {
                callback(err);
            });
        });
    });
};
