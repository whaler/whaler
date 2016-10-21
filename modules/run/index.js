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

        const extraHosts = [];
        if (containers) {
            for (let data of containers) {
                const parts = data['Names'][0].substr(1).split('.');
                try {
                    const container = docker.getContainer(data['Id']);
                    const info = yield container.inspect.$call(container);
                    extraHosts.push(parts[0] + ':' + info['NetworkSettings']['IPAddress']);
                } catch (e) {}
            }
        }

        const serviceContainer = docker.getContainer(serviceName + '.' + appName);
        const info = yield serviceContainer.inspect.$call(serviceContainer);
        const attachStdin = options['stdin'];

        if ('string' === typeof options['cmd']) {
            options['cmd'] = docker.util.parseCmd(options['cmd']);
        }

        let nameSuffix;
        if (options['detach'] || false) {
            nameSuffix = '_detached_' + process.pid;
        } else {
            nameSuffix = '_pty_' + process.pid;
        }

        const createOpts = {
            'name': serviceName + '.' + appName + nameSuffix,
            'Cmd': options['cmd'],
            'Env': info['Config']['Env'],
            'Labels': {},
            'Image': info['Config']['Image'],
            'WorkingDir': info['Config']['WorkingDir'],
            'Entrypoint': false === options['entrypoint'] ? null : info['Config']['Entrypoint'],
            'StdinOnce': false,
            'AttachStdin': attachStdin,
            'AttachStdout': true,
            'AttachStderr': true,
            'OpenStdin': attachStdin,
            'Tty': options['tty'],
            'HostConfig': {
                'ExtraHosts': extraHosts,
                'Binds': info['HostConfig']['Binds'],
                'VolumesFrom': info['HostConfig']['VolumesFrom']
            }
        };
        createOpts['Labels']['whaler.on-die'] = 'remove';

        const startOpts = {};

        const container = yield docker.createContainer.$call(docker, createOpts);

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
