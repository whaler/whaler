'use strict';

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
function exports(whaler) {

    whaler.on('run', function* (options) {
        let appName = options['ref'];
        let serviceName = null;

        const parts = options['ref'].split('.');
        if (2 == parts.length) {
            appName = parts[1];
            serviceName = parts[0];
        }

        if (!serviceName) {
            throw new Error('Command requires to specify a service name.');
        }

        const docker = whaler.get('docker');
        // const storage = whaler.get('apps');
        // const app = yield storage.get.$call(storage, appName);

        const containers = yield docker.listContainers.$call(docker, {
            all: false,
            filters: JSON.stringify({
                name: [
                    docker.util.nameFilter(appName)
                ]
            })
        });

        const serviceContainer = docker.getContainer(serviceName + '.' + appName);
        const info = yield serviceContainer.inspect.$call(serviceContainer);
        const attachStdin = options['stdin'];

        if ('string' === typeof options['cmd']) {
            const hasEntrypoint = !!info['Config']['Entrypoint'] && info['Config']['Entrypoint'].length && options['entrypoint'];
            if (hasEntrypoint) {
                options['cmd'] = docker.util.parseCmd(options['cmd']);
            } else {
                options['cmd'] = ['/bin/sh', '-c', options['cmd']];
            }
        }

        let nameSuffix;
        if (options['detach'] || false) {
            nameSuffix = '_detached_' + process.pid;
        } else {
            nameSuffix = '_pty_' + process.pid;
        }

        const createOpts = {
            'name': serviceName + '.' + appName + nameSuffix,
            'Hostname': '',
            'Cmd': options['cmd'],
            'Env': (info['Config']['Env'] || []).concat(options['env'] || []),
            'Labels': {},
            'Image': info['Config']['Image'],
            'WorkingDir': info['Config']['WorkingDir'],
            'Entrypoint': false === options['entrypoint'] ? [] : info['Config']['Entrypoint'],
            'StdinOnce': false,
            'AttachStdin': attachStdin,
            'AttachStdout': true,
            'AttachStderr': true,
            'OpenStdin': attachStdin,
            'Tty': options['tty'],
            'HostConfig': {
                'AutoRemove': true,
                'ExtraHosts': info['HostConfig']['ExtraHosts'],
                'Binds': info['HostConfig']['Binds'],
                'VolumesFrom': info['HostConfig']['VolumesFrom']
            }
        };

        const startOpts = {};

        const container = yield docker.createContainer.$call(docker, createOpts);

        let whalerNetwork = docker.getNetwork('whaler_nw');
        yield whalerNetwork.connect.$call(whalerNetwork, {
            'Container': container.id
        });

        let appNetwork = docker.getNetwork('whaler_nw.' + appName);
        yield appNetwork.connect.$call(appNetwork, {
            'Container': container.id
        });

        container.run = function* () {

            let err = null;
            let data = null;

            if (options['detach'] || false) {
                try {
                    yield container.start.$call(container, startOpts);
                    data = yield container.inspect.$call(container);

                } catch (e) {
                    err = e;
                }
                
            } else {

                let revertPipe = function () {};
                let revertResize = function () {};

                try {
                    const stream = yield container.attach.$call(container, {
                        stream: true,
                        stdin: attachStdin,
                        stdout: true,
                        stderr: true
                    });

                    revertPipe = pipe(whaler, stream, attachStdin, options['tty']);

                    yield container.start.$call(container, startOpts);

                    if (options['tty']) {
                        revertResize = docker.util.resizeTTY(container);
                    }

                    data = yield container.wait.$call(container);

                } catch (e) {
                    err = e;
                }

                revertPipe();
                revertResize();
            }

            if (err) {
                throw err;
            }

            return data;
        };

        container.exit = function* () {
            try {
                yield container.remove.$call(container, {
                    v: true,
                    force: true
                });
            } catch (e) {}
        };

        return container;
    });
}

// PRIVATE

/**
 * @param whaler
 * @param stream
 * @param attachStdin
 * @param tty
 * @returns {Function}
 */
function pipe(whaler, stream, attachStdin, tty) {
    let unpipeStream = function() {};

    if (tty) {
        stream.setEncoding('utf8');
        stream.pipe(process.stdout, { end: false });
        unpipeStream = function() {
            stream.unpipe(process.stdout);
        };
    } else {
        whaler.get('docker').modem.demuxStream(stream, process.stdout, process.stderr);
    }

    const CTRL_ALT_C = '\u001B\u0003';
    const isRaw = process.isRaw;
    const keyPress = function(key) {
        if (key === CTRL_ALT_C) {
            whaler.emit('SIGINT');
        }
    };

    if (attachStdin) {
        process.stdin.resume();
        process.stdin.setRawMode(true);
        process.stdin.pipe(stream);
        process.stdin.on('data', keyPress);
    }

    return function revert() {
        if (stream.end) {
            stream.end();
        }

        unpipeStream();

        if (attachStdin) {
            process.stdin.removeListener('data', keyPress);
            process.stdin.unpipe(stream);
            process.stdin.setRawMode(isRaw);
            process.stdin.resume();
            process.stdin.pause();
        }
    }
}
