'use strict';

var Q = require('q');
var fs = require('fs');

var addCmd = function(whaler) {
    var pkg = require('./package.json');
    var console = whaler.require('./lib/console');

    whaler.cli.command(
        pkg.name + ' [ref]'
    ).description(
        pkg.description
    ).option(
        '--init [CONFIG]',
        'Initialize application if not exist yet'
    ).action(function(ref, options) {

        whaler.events.emit('start', {
            ref: ref,
            init: options.init
        }, function(err, containers) {
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
    var str2time = whaler.require('./lib/str2time');

    var listContainers = Q.denodeify(whaler.docker.listContainers);
    var containerInspect = Q.denodeify(function(container, callback) {
        container.inspect(callback);
    });
    var containerStart = Q.denodeify(function(container, opts, callback) {
        container.start(opts, callback);
    });
    var containerLogs = Q.denodeify(function(container, wait, callback) {
        container.logs({
            follow: true,
            stdout: true,
            stderr: true
        }, function(err, stream) {
            if (err) {
                callback(err);
            }

            var exit = function() {
                stream.socket.end();
                process.stdout.write('\n');
                callback(null);
            };

            var timeoutId = setTimeout(exit, wait * 1000);

            stream.setEncoding('utf8');
            stream.on('data', function(data) {
                if (-1 !== data.indexOf('@whaler ready in') || -1 !== data.indexOf('@whaler wait')) {
                    var sleepTime = str2time(data);
                    console.info('[%s] Waiting %ss to make sure container is started.', process.pid, sleepTime / 1000, '\n');
                    clearTimeout(timeoutId);
                    setTimeout(exit, sleepTime);

                    if (-1 !== data.indexOf('@whaler ready in')) {
                        console.warn('[%s] "@me ready in" is deprecated, please use "@whaler wait" instead.', process.pid, '\n');
                    }

                } else {
                    process.stdout.write(data);
                }
            });
        });
    });

    var injectIps = function(appName) {
        var promise = Q.async(function*() {
            try {
                var containers = yield listContainers({
                    all: false,
                    filters: JSON.stringify({
                        name: [
                            whaler.helpers.getDockerFiltersNamePattern(appName)
                        ]
                    })
                });
            } catch (e) {}

            if (!containers) {
                return;
            }

            var hosts = [];
            var values = [];
            var domains = [];

            while (containers.length) {
                var data = containers.shift();
                var parts = data['Names'][0].substr(1).split('.');
                try {
                    var info = yield containerInspect(whaler.docker.getContainer(data['Id']));
                    hosts.push(info['HostsPath']);
                    domains.push(parts[0]);
                    values.push(info['NetworkSettings']['IPAddress'] + '\t' + parts[0] + '\n');
                } catch (e) {}
            }

            var re = new RegExp('([0-9\\.])+\\s+(' + domains.map(function(value) {
                return value.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            }).join('|') + ')\\n', 'g');

            hosts.forEach(function(hostsPath) {
                fs.readFile(hostsPath, 'utf-8', function(err, data) {
                    if (!err) {
                        data = data.replace(re, '') + values.join('');
                        fs.writeFile(hostsPath, data, 'utf-8', function(err) {});
                    }
                });
            });
        })();
    };

    var emitInit = Q.denodeify(function(options, callback) {
        whaler.events.emit('init', options, callback);
    });
    var emitCreate = Q.denodeify(function(ref, callback) {
        whaler.events.emit('create', {
            ref: ref
        }, callback);
    });

    whaler.events.on('start', function(options, callback) {
        options['ref'] = whaler.helpers.getRef(options['ref']);
        options['init'] = options['init'] || false;

        var appName = options['ref'];
        var containerName = null;

        var parts = options['ref'].split('.');
        if (2 == parts.length) {
            appName = parts[1];
            containerName = parts[0];
        }

        var exit = function() {
            process.removeListener('SIGINT', exit);
            process.stdout.write('\n');
            process.exit();
        };
        process.on('SIGINT', exit);

        whaler.apps.get(appName, function(err, app) {
            var promise = Q.async(function*() {
                if (err) {
                    if (options['init']) {
                        app = yield emitInit({
                            name: appName,
                            config: 'string' === typeof options['init'] ? options['init'] : undefined
                        });
                        err = null;
                    }
                }

                if (err) {
                    throw err;
                }

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

                var extraHosts = [];
                var containers = {};

                if (containerName) {
                    names = [containerName];
                }

                while (names.length) {
                    var name = names.shift();

                    var container = whaler.docker.getContainer(name + '.' + appName);

                    var info = null;
                    try {
                        info = yield containerInspect(container);
                    } catch (e) {}

                    var needStart = true;
                    if (info) {
                        if (info['State']['Running']) {
                            needStart = false;
                            console.warn('[%s] Container "%s.%s" already running.', process.pid, name, appName, '\n');
                        }

                    } else {
                        var result = yield emitCreate(name + '.' + appName);
                        container = result[name];
                    }

                    if (needStart) {
                        console.info('[%s] Starting "%s.%s" container.', process.pid, name, appName,'\n');

                        info = yield containerInspect(container);

                        var startOpts = info['HostConfig'];
                        startOpts['ExtraHosts'] = extraHosts;

                        var wait = false;
                        if (info['Config']['Labels'] && info['Config']['Labels']['whaler.wait']) {
                            wait = str2time(info['Config']['Labels']['whaler.wait']);
                        }

                        if (info['LogPath']) {
                            yield fs.truncate(info['LogPath'], 0);
                        }

                        var data = yield containerStart(container, startOpts);

                        injectIps(appName);

                        if (wait) {
                            yield containerLogs(container, wait);
                        }

                        info = yield containerInspect(container);

                        console.info('[%s] Container "%s.%s" started.', process.pid, name, appName,'\n');
                    }

                    extraHosts.push(name + ':' + info['NetworkSettings']['IPAddress']);

                    containers[name] = container;
                }

                return containers;
            })();

            promise.done(function(containers) {
                callback(null, containers);
                process.removeListener('SIGINT', exit);
            }, function(err) {
                callback(err);
                process.removeListener('SIGINT', exit);
            });
        });
    });
};
