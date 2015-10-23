'use strict';

var Q = require('q');

var addCmd = function(whaler) {
    var pkg = require('./package.json');
    var console = whaler.require('./lib/console');

    whaler.cli.command(
        pkg.name + ' [ref] [cmd]'
    ).description(
        pkg.description
    ).option(
        '--no-tty',
        'Disable tty binding'
    ).action(function(ref, cmd, options) {

        whaler.events.emit('run', {
            ref: ref,
            cmd: cmd,
            tty: options.tty
        }, function(err, data) {
            if (err) {
                return console.error('[%s] %s', process.pid, err.message, '\n');
            }
        });

    }).on('--help', function() {
        whaler.cli.argumentsHelp(this, {
            'ref': 'Container name',
            'cmd': 'Command to execute'
        });
    });
};

module.exports = function(whaler) {

    addCmd(whaler);

    var console = whaler.require('./lib/console');

    var listContainers = Q.denodeify(whaler.docker.listContainers);
    var createContainer = Q.denodeify(whaler.docker.createContainer);
    var containerInspect = Q.denodeify(function(container, callback) {
        container.inspect(callback);
    });
    var containerWait = Q.denodeify(function(container, callback) {
        container.wait(callback);
    });
    var containerStart = Q.denodeify(function(container, opts, callback) {
        container.start(opts, callback);
    });
    var containerAttach = Q.denodeify(function(container, opts, callback) {
        container.attach(opts, callback);
    });

    // Resize tty
    var resize = function(container) {
        var dimensions = {
            h: process.stdout.rows,
            w: process.stderr.columns
        };

        if (dimensions.h != 0 && dimensions.w != 0) {
            container.resize(dimensions, function() {});
        }
    };

    // Exit container
    var exit = function(stdin, container, stream, isRaw) {
        if (stream) {
            if (stdin) {
                process.stdin.removeAllListeners();
                process.stdin.setRawMode(isRaw);
                process.stdin.resume();
            }

            if (stream.end) {
                stream.end();
            }
        }

        if (container) {
            container.remove({}, function() {
                if (stdin) {
                    process.exit();
                }
            });
        }
    };

    whaler.events.on('run', function(options, callback) {
        options['ref'] = whaler.helpers.getRef(options['ref']);
        options['cmd'] = options['cmd'] || '/bin/sh';
        options['tty'] = 'boolean' === typeof options['tty'] ? options['tty'] : false;

        if ('string' === typeof options['cmd']) {
            options['cmd'] = whaler.docker.util.parseCmd(options['cmd']);
        }

        var CTRL_P = '\u0010';
        var CTRL_Q = '\u0011';
        var isRaw = undefined;
        var previousKey = null;

        var stdin = options['tty'];
        var appName = options['ref'];
        var containerName = null;

        var parts = options['ref'].split('.');
        if (2 == parts.length) {
            appName = parts[1];
            containerName = parts[0];
        }

        if (!containerName) {
            return callback(
                new Error('Command requires to specify a container name.')
            );
        }

        whaler.apps.find({ _id: appName }, function(err, docs) {

            var promise = Q.async(function*() {

                if (docs.length < 1 || appName !== docs[0]['_id']) {
                    throw new Error('An application with "' + appName + '" name not found.');
                }

                var containers = yield listContainers({
                    all: false,
                    filters: JSON.stringify({
                        name: [
                            whaler.helpers.getDockerFiltersNamePattern(appName)
                        ]
                    })
                });

                var extraHosts = [];
                if (containers) {
                    while (containers.length) {
                        var data = containers.shift();
                        var parts = data['Names'][0].substr(1).split('.');
                        try {
                            var info = yield containerInspect(whaler.docker.getContainer(data['Id']));
                            extraHosts.push(parts[0] + ':' + info['NetworkSettings']['IPAddress']);
                        } catch (e) {}
                    }
                }

                var info = yield containerInspect(whaler.docker.getContainer(containerName + '.' + appName));

                var createOpts = {
                    'name': containerName + '.' + appName + '_pty_' + process.pid,
                    'Cmd': options['cmd'],
                    'Env': info['Config']['Env'],
                    'Image': info['Config']['Image'],
                    'WorkingDir': info['Config']['WorkingDir'],
                    'Entrypoint': info['Config']['Entrypoint'],
                    'StdinOnce': false,
                    'AttachStdin': stdin,
                    'AttachStdout': true,
                    'AttachStderr': true,
                    'OpenStdin': stdin,
                    'Tty': true
                };

                var startOpts = {
                    'ExtraHosts': extraHosts,
                    'Binds': info['HostConfig']['Binds']
                };

                var container = yield createContainer(createOpts);

                try {
                    var stream = yield containerAttach(container, {
                        stream: true,
                        stdin: stdin,
                        stdout: true,
                        stderr: true
                    });
                } catch (e) {
                    exit(stdin, container);
                    throw e;
                }

                stream.setEncoding('utf8');
                stream.pipe(process.stdout, { end: true });

                if (stdin) {
                    isRaw = process.isRaw;
                    process.stdin.resume();
                    process.stdin.setEncoding('utf8');
                    process.stdin.setRawMode(true);
                    process.stdin.pipe(stream);

                    process.stdin.on('data', function(key) {
                        // Detects it is detaching a running container
                        if (previousKey === CTRL_P && key === CTRL_Q) {
                            exit(stdin, container, stream, isRaw);
                        }
                        previousKey = key;
                    });
                }

                try {
                    var data = yield containerStart(container, startOpts);
                } catch (e) {
                    exit(stdin, container, stream, isRaw);
                    throw e;
                }

                if (stdin) {
                    var resizeContainer = function() {
                        resize(container);
                    };
                    resizeContainer();
                    process.stdout.on('resize', resizeContainer);
                } else {
                    var killContainer = function() {
                        container.kill({}, function(err, data) {
                            console.log('\n');
                            console.warn('[%s] %s', process.pid, 'Container killed', '\n');
                        });
                    };
                    process.on('SIGINT', killContainer);
                }

                var err = null;
                var data = null;
                try {
                    data = yield containerWait(container);
                } catch (e) {
                    err = e;
                }

                if (stdin) {
                    process.stdout.removeListener('resize', resizeContainer);
                } else {
                    process.removeListener('SIGINT', killContainer);
                }
                exit(stdin, container, stream, isRaw);

                if (err) {
                    throw err;
                }

                if (!stdin) {
                    return data;
                }
            })();

            promise.done(function(data) {
                callback(null, data);
            }, function (err) {
                callback(err);
            });
        });
    });
};
