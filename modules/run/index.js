'use strict';

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
async function exports (whaler) {

    whaler.on('run', async ctx => {
        let appName = ctx.options['ref'];
        let serviceName = null;

        const parts = ctx.options['ref'].split('.');
        if (2 == parts.length) {
            appName = parts[1];
            serviceName = parts[0];
        }

        if (!serviceName) {
            throw new Error('Command requires to specify a service name.');
        }

        const { default: docker } = await whaler.fetch('docker');
        // const { default: storage } = await whaler.fetch('apps');
        // const app = await storage.get(appName);

        await docker.listContainers({
            all: false,
            filters: JSON.stringify({
                name: [
                    docker.util.nameFilter(appName)
                ]
            })
        });

        const serviceContainer = docker.getContainer(serviceName + '.' + appName);
        const info = await serviceContainer.inspect();
        const attachStdin = ctx.options['stdin'];

        if ('string' === typeof ctx.options['cmd']) {
            const hasEntrypoint = !!info['Config']['Entrypoint'] && info['Config']['Entrypoint'].length && ctx.options['entrypoint'];
            if (hasEntrypoint) {
                ctx.options['cmd'] = docker.util.parseCmd(ctx.options['cmd']);
            } else {
                ctx.options['cmd'] = ['/bin/sh', '-c', ctx.options['cmd']];
            }
        }

        let nameSuffix;
        if (ctx.options['detach'] || false) {
            nameSuffix = '_detached_' + process.pid;
        } else {
            nameSuffix = '_pty_' + process.pid;
        }

        const createOpts = {
            'name': serviceName + '.' + appName + nameSuffix,
            'Hostname': '',
            'Cmd': ctx.options['cmd'],
            'Env': (info['Config']['Env'] || []).concat(ctx.options['env'] || []),
            'Labels': {},
            'Image': info['Config']['Image'],
            'WorkingDir': info['Config']['WorkingDir'],
            'Entrypoint': false === ctx.options['entrypoint'] ? [] : info['Config']['Entrypoint'],
            'StdinOnce': false,
            'AttachStdin': attachStdin,
            'AttachStdout': true,
            'AttachStderr': true,
            'OpenStdin': attachStdin,
            'Tty': ctx.options['tty'],
            'HostConfig': {
                'AutoRemove': true,
                'ExtraHosts': info['HostConfig']['ExtraHosts'],
                'Binds': info['HostConfig']['Binds'],
                'VolumesFrom': info['HostConfig']['VolumesFrom']
            }
        };

        const startOpts = {};

        const container = await docker.createContainer(createOpts);

        let whalerNetwork = docker.getNetwork('whaler_nw');
        await whalerNetwork.connect({
            'Container': container.id
        });

        let appNetwork = docker.getNetwork('whaler_nw.' + appName);
        await appNetwork.connect({
            'Container': container.id
        });

        container.run = async () => {
            let err = null;
            let data = null;

            if (ctx.options['detach'] || false) {
                try {
                    await container.start(startOpts);
                    data = await container.inspect();
                } catch (e) {
                    err = e;
                }

            } else {
                let revertPipe = () => {};
                let revertResize = () => {};

                try {
                    const stream = await container.attach({
                        stream: true,
                        stdin: attachStdin,
                        stdout: true,
                        stderr: true
                    });

                    revertPipe = await pipe(stream, attachStdin, ctx.options['tty']);

                    await container.start(startOpts);

                    if (ctx.options['tty']) {
                        revertResize = docker.util.resizeTTY(container);
                    }

                    data = await container.wait();
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

        container.exit = async () => {
            try {
                await container.remove({
                    v: true,
                    force: true
                });
            } catch (e) {}
        };

        ctx.result = container;
    });

    // PRIVATE

    const pipe = async (stream, attachStdin, tty) => {
        let unpipeStream = () => {};

        if (tty) {
            stream.setEncoding('utf8');
            stream.pipe(process.stdout, { end: false });
            unpipeStream = () => {
                stream.unpipe(process.stdout);
            };
        } else {
            (await whaler.fetch('docker')).default.modem.demuxStream(stream, process.stdout, process.stderr);
        }

        const CTRL_ALT_C = '\u001B\u0003';
        const isRaw = process.isRaw;
        const keyPress = (key) => {
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
    };
}
