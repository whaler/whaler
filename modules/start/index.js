'use strict';

const fs = require('fs').promises;
const util = require('util');
const str2time = require('../../lib/str2time');

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
async function exports (whaler) {

    whaler.on('start', async ctx => {
        let appName = ctx.options['ref'];
        let serviceName = null;

        if (ctx.options['init'] && !/^[a-z0-9-]+$/.test(appName)) {
            throw new Error('Application name `' + appName + '` includes invalid characters, only `[a-z0-9-]` are allowed.');
        }

        const parts = ctx.options['ref'].split('.');
        if (2 == parts.length) {
            appName = parts[1];
            serviceName = parts[0];
        }

        const { default: docker } = await whaler.fetch('docker');
        const { default: storage } = await whaler.fetch('apps');

        let app;
        try {
            app = await storage.get(appName);
        } catch (e) {
            if (ctx.options['init']) {
                app = await whaler.emit('init', {
                    name: appName,
                    ...ctx.options['init']
                });
            } else {
                throw e;
            }
        }

        let services;

        if (serviceName) {
            services = [serviceName];

        } else {
            services = Object.keys(app.config['data']['services']);

            let containers = await docker.listContainers({
                all: true,
                filters: JSON.stringify({
                    name: [
                        docker.util.nameFilter(appName)
                    ]
                })
            });

            containers = containers.filter(data => {
                const parts = data['Names'][0].substr(1).split('.');
                return -1 == services.indexOf(parts[0]);
            }).map(data => {
                const labels = data['Labels'] || {};
                const parts = data['Names'][0].substr(1).split('.');
                return Object.assign({
                    name: labels['whaler.service'] || parts[0],
                    after: null,
                    before: null,
                }, JSON.parse(labels['whaler.position'] || '{}'));
            });
            containers.sort((a, b) => {
                if (!a.before || !b.after || a.after == b.name || b.before == a.name) {
                    return 1;
                }
                if (!a.after || !b.before || a.before == b.name || b.after == a.name) {
                    return -1;
                }
                return 0;
            });

            for (let data of containers) {
                services.push(data.name);
            }
        }

        const containers = {};

        for (let name of services) {
            let container = docker.getContainer(name + '.' + appName);

            let info = null;
            try {
                info = await container.inspect();
            } catch (e) {}

            let needStart = true;
            if (info) {
                if (info['State']['Running']) {
                    needStart = false;
                    whaler.warn('Container `%s.%s` already running.', name, appName);
                } else {
                    let waitMode = 'noninteractive';
                    if (info['Config']['Labels'] && info['Config']['Labels']['whaler.wait']) {
                        if ('interactive' === process.env.WHALER_WAIT_MODE) {
                            if ('interactive' === process.env.WHALER_FRONTEND && process.stdout.isTTY) {
                                waitMode = 'interactive';
                            }
                        }
                    }

                    let needRebuild = false;
                    if ('interactive' === waitMode) {
                        if (!info['Config']['Tty']) {
                            needRebuild = true;
                            whaler.warn('Rebuild container `%s.%s` to interactive mode.', name, appName);
                        }
                    } else {
                        if (info['Config']['Tty']) {
                            needRebuild = true;
                            whaler.warn('Rebuild container `%s.%s` to non-interactive mode.', name, appName);
                        }
                    }

                    if (needRebuild) {
                        needStart = false;
                        await whaler.emit('rebuild', {
                            ref: name + '.' + appName
                        });
                    }
                }

            } else {
                const result = await whaler.emit('create', {
                    ref: name + '.' + appName
                });
                container = result[name];
            }

            if (needStart) {
                whaler.info('Starting `%s.%s` container.', name, appName);

                info = await container.inspect();

                let wait = false;
                if (info['Config']['Labels'] && info['Config']['Labels']['whaler.wait']) {
                    wait = str2time(info['Config']['Labels']['whaler.wait']);
                }

                if (wait) {
                    let stream = null;
                    let revertResize = () => {};
                    let attachStdin = info['Config']['AttachStdin'];
                    let tty = info['Config']['Tty'];

                    if (tty) {
                        stream = await container.attach({
                            stream: true,
                            stdin: true,
                            stdout: true,
                            stderr: true
                        });
                        revertResize = docker.util.resizeTTY(container);
                        await container.start();

                    } else {
                        await container.start();
                        stream = await container.logs({
                            follow: true,
                            stdout: true,
                            stderr: true,
                            since: Math.floor(new Date().getTime() / 1000)
                        });
                    }

                    const revertPipe = await pipe(stream, attachStdin);

                    whaler.before('kill', async ctx => {
                        revertPipe();
                        revertResize();
                    });

                    await writeLogs(docker, stream, wait, tty);

                    revertPipe();
                    revertResize();
                } else {
                    await container.start();
                }

                info = await container.inspect();

                whaler.info('Container `%s.%s` started.', name, appName);
            }

            containers[name] = container;
        }

        ctx.result = containers;
    });

    // PRIVATE

    const pipe = async (stream, attachStdin) => {
        let unpipeStream = () => {
            if (stream) {
                if (stream.end) {
                    stream.end();
                }
                if (stream.destroy) {
                    stream.destroy();
                }
            }
        };

        const CTRL_ALT_C = '\u001B\u0003';
        const isRaw = process.isRaw;
        const keyPress = (key) => {
            if (key === CTRL_ALT_C) {
                whaler.kill('SIGINT');
            }
        };

        if (attachStdin) {
            process.stdin.resume();
            process.stdin.setRawMode(true);
            process.stdin.pipe(stream);
            process.stdin.on('data', keyPress);
        }

        return function revert () {
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

    const writeLogs = util.promisify((docker, stream, wait, tty, callback) => {
        let timeoutId = setTimeout(() => {
            callback(null);
        }, wait);

        let firstStr = true;
        const stdout = {
            write: data => {
                if ('string' !== typeof data) {
                    data = data.toString('utf8');
                }

                if (firstStr) {
                    firstStr = false;
                    if (!isWhalerWait(data)) {
                        const line = data.split('\n')[0].trim();
                        if ('' !== line) {
                            process.stdout.write('\n');
                        }
                    }
                }

                const sleepTime = processStdoutWrite(data);
                if (null !== sleepTime) {
                    firstStr = true;
                    clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => {
                        callback(null);
                    }, sleepTime);
                }
            }
        };

        if (tty) {
            stream.setEncoding('utf8');
            stream.on('data', stdout.write);

        } else {
            docker.modem.demuxStream(stream, stdout, stdout);
        }
    });

    const isWhalerWait = data => {
        if (-1 !== data.indexOf('@whaler ready in') || -1 !== data.indexOf('@whaler wait')) {
            return true;
        }
        return false;
    };

    const processStdoutWrite = data => {
        if (isWhalerWait(data)) {
            const sleepTime = str2time(data.split('@whaler')[1].split('\n')[0].trim());
            whaler.info('Waiting %ss to make sure container is started.', sleepTime / 1000);

            if (-1 !== data.indexOf('@whaler ready in')) {
                whaler.warn('`@me ready in` is deprecated, please use `@whaler wait` instead.');
            }

            return sleepTime;

        } else {
            process.stdout.write(data);
        }

        return null;
    };

}
