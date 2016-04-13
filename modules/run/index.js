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
        const storage = whaler.get('apps');
        const app = yield storage.get.$call(storage, appName);

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
        const attachStdin = options['tty'];

        if ('string' === typeof options['cmd']) {
            options['cmd'] = docker.util.parseCmd(options['cmd']);
        }

        const createOpts = {
            'name': serviceName + '.' + appName + '_pty_' + process.pid,
            'Cmd': options['cmd'],
            'Env': info['Config']['Env'],
            'Image': info['Config']['Image'],
            'WorkingDir': info['Config']['WorkingDir'],
            'Entrypoint': false === options['entrypoint'] ? null : info['Config']['Entrypoint'],
            'StdinOnce': false,
            'AttachStdin': attachStdin,
            'AttachStdout': true,
            'AttachStderr': true,
            'OpenStdin': attachStdin,
            'Tty': true
        };

        const startOpts = {
            'ExtraHosts': extraHosts,
            'Binds': info['HostConfig']['Binds']
        };

        const container = yield docker.createContainer.$call(docker, createOpts);

        container.run = function* () {

            let err = null;
            let data = null;

            let revertPipe = function() {};
            let revertResize = function() {};

            try {
                const stream = yield container.attach.$call(container, {
                    stream: true,
                    stdin: attachStdin,
                    stdout: true,
                    stderr: true
                });

                revertPipe = pipe(stream, attachStdin);

                yield container.start.$call(container, startOpts);

                if (attachStdin) {
                    revertResize = resize(container);
                }

                data = yield container.wait.$call(container);

            } catch (e) {
                err = e;
            }

            revertPipe();
            revertResize();

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
 * @param stream
 * @param attachStdin
 * @returns {Function}
 */
function pipe(stream, attachStdin) {

    stream.setEncoding('utf8');
    stream.pipe(process.stdout, { end: false });

    //const CTRL_C = '\u0003';
    //const CTRL_D = '\u0004';
    const isRaw = process.isRaw;
    //const keyPress = function(key) {
    //    if (key === CTRL_C || key === CTRL_D) {
    //        process.stdout.write('exit');
    //        stream.end();
    //    }
    //};

    if (attachStdin) {
        process.stdin.resume();
        process.stdin.setRawMode(true);
        process.stdin.pipe(stream);
        //process.stdin.on('data', keyPress);
    }

    return function revert() {
        if (stream.end) {
            stream.end();
        }

        stream.unpipe(process.stdout);

        if (attachStdin) {
            //process.stdin.removeListener('data', keyPress);
            process.stdin.unpipe(stream);
            process.stdin.setRawMode(isRaw);
            process.stdin.resume();
            process.stdin.pause();
        }
    }
}

/**
 * Resize tty
 * @param container
 */
function resize(container) {
    const resizeContainer = function() {
        const dimensions = {
            h: process.stdout.rows,
            w: process.stderr.columns
        };

        if (dimensions.h != 0 && dimensions.w != 0) {
            container.resize(dimensions, () => {});
        }
    };

    resizeContainer();
    process.stdout.on('resize', resizeContainer);

    return function revert() {
        process.stdout.removeListener('resize', resizeContainer);
    }
}
