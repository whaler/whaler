'use strict';

var Q = require('q');
var path = require('path');

var addCmd = function(whaler) {
    var pkg = require('./package.json');
    var console = whaler.require('./lib/console');

    whaler.cli.command(
        pkg.name + ' [ref]'
    ).description(
        pkg.description
    ).option(
        '--config <CONFIG>',
        'Config to use'
    ).action(function(ref, options) {

        whaler.events.emit('create', {
            ref: ref,
            config: options.config
        }, function(err, containers) {
            if (err) {
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

    var pull = Q.denodeify(whaler.docker.pull);
    var buildImage = Q.denodeify(whaler.docker.buildImage);
    var createContainer = Q.denodeify(whaler.docker.createContainer);
    var createDockerfile = Q.denodeify(whaler.docker.createDockerfile);

    var emitVars = Q.denodeify(function(callback) {
        whaler.events.emit('vars', {}, callback);
    });
    var emitConfig = Q.denodeify(function(options, callback) {
        whaler.events.emit('config', options, callback);
    });

    whaler.events.on('create', function(options, callback) {
        options['ref'] = whaler.helpers.getRef(options['ref']);

        var appName = options['ref'];
        var containerName = null;

        var parts = options['ref'].split('.');
        if (2 == parts.length) {
            appName = parts[1];
            containerName = parts[0];
        }

        whaler.apps.find({ _id: appName }, function(err, docs) {

            var promise = Q.async(function*() {

                if (docs.length < 1 || appName !== docs[0]['_id']) {
                    throw new Error('An application with "' + appName + '" name not found.');
                }

                var app = docs[0];
                var appConfig = app.config;
                if (options['config']) {
                    appConfig = yield emitConfig({
                        name: appName,
                        config: options['config']
                    });
                }

                if (containerName) {
                    if (!appConfig['data'][containerName]) {
                        throw new Error('Config for "' + options['ref'] + '" not found.');
                    }
                }

                var containers = {};
                var names = Object.keys(appConfig['data']);
                if (containerName) {
                    names = [containerName];
                }

                var vars = yield emitVars();

                while (names.length) {
                    var name = names.shift();
                    var config = appConfig['data'][name];

                    console.info('[%s] Creating "%s.%s" container.', process.pid, name, appName,'\n');

                    config['env'] = config['env'] || [];
                    for (var v in vars) {
                        var exists = false;
                        var arr = config['env'].slice(0);
                        if (arr.length) {
                            while (arr.length) {
                                var env = arr.shift().split('=');
                                if (-1 !== (env[0] + '=').indexOf(v + '=')) {
                                    exists = true;
                                }
                            }
                        }
                        if (!exists) {
                            config['env'].push(v + '=' + vars[v]);
                        }
                    }

                    var createOpts = {
                        'name': name + '.' + appName,
                        'Image': null,
                        'Tty': true,
                        'Env': config['env'],
                        'Labels': {},
                        'ExposedPorts': {},
                        'HostConfig': {
                            'Binds': [
                                '/etc/whaler/bin/me:/usr/bin/@me'
                            ],
                            PortBindings: {}
                        }
                    };

                    if (config['image']) {
                        var output = yield pull(config['image']);
                        createOpts['Image'] = config['image'];

                    } else {
                        if (config['build']) {
                            var build = config['build'];
                            if (build && !path.isAbsolute(build)) {
                                build = path.join(path.dirname(appConfig['file']), path.normalize(build));
                            }
                            var file = yield createDockerfile(build);

                        } else {
                            var storage = config['dockerfile-storage'] || null;
                            if (storage && !path.isAbsolute(storage)) {
                                storage = path.join(path.dirname(appConfig['file']), path.normalize(storage));
                            }
                            var file = yield createDockerfile({
                                dockerfile: config['dockerfile'],
                                storage: storage
                            });
                        }

                        var image = 'whaler_' + appName + '_' + name;
                        var output = yield buildImage(file, image);

                        createOpts['Image'] = image;
                    }

                    if (config['wait']) {
                        createOpts['Labels']['whaler.wait'] = config['wait'].toString();
                    }

                    if (config['workdir']) {
                        createOpts['WorkingDir'] = config['workdir'];
                    }

                    if (config['entrypoint']) {
                        createOpts['Entrypoint'] = config['entrypoint'];
                    }

                    if (config['cmd']) {
                        if ('string' === typeof config['cmd']) {
                            config['cmd'] = whaler.docker.util.parseCmd(config['cmd']);
                        }
                        createOpts['Cmd'] = config['cmd'];
                    }

                    if (config['volumes']) {
                        config['volumes'].forEach(function(value) {
                            var arr = value.split(':');
                            if (!path.isAbsolute(arr[0])) {
                                arr[0] = path.join(path.dirname(appConfig['file']), path.normalize(arr[0]));
                            }
                            createOpts['HostConfig']['Binds'].push(arr.join(':'));
                        });
                    }

                    if (config['ports']) {
                        config['ports'].forEach(function(value) {
                            var arr = value.split(':');
                            var port = arr[1];
                            var hostPort = arr[0];
                            var hostIp = '';

                            if (3 === arr.length) {
                                port = arr[2];
                                hostPort = arr[1];
                                hostIp = arr[0];
                            }

                            if (-1 == port.indexOf('/tcp') || -1 == port.indexOf('/udp')) {
                                port += '/tcp';
                            }

                            createOpts['ExposedPorts'][port] = {};
                            createOpts['HostConfig']['PortBindings'][port] = [
                                {
                                    'HostIp': hostIp,
                                    'HostPort': hostPort
                                }
                            ];
                        });
                    }

                    var container = yield createContainer(createOpts);

                    console.info('[%s] Container "%s.%s" created.', process.pid, name, appName,'\n');

                    containers[name] = container;
                }

                return containers;
            })();

            promise.done(function(containers) {
                callback(null, containers);
            }, function (err) {
                callback(err);
            });
        });
    });
};
