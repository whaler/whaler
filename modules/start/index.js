'use strict';

var fs = require('fs');
var str2time = require('../../lib/str2time');
var console = require('x-console');

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
function exports(whaler) {

    whaler.on('start', function* (options) {
        let appName = options['ref'];
        let serviceName = null;

        const parts = options['ref'].split('.');
        if (2 == parts.length) {
            appName = parts[1];
            serviceName = parts[0];
        }

        const docker = whaler.get('docker');
        const storage = whaler.get('apps');

        let app;
        try {
            app = yield storage.get.$call(storage, appName);
        } catch (e) {
            if (options['init']) {
                app = yield whaler.$emit('init', {
                    name: appName,
                    config: 'string' === typeof options['init'] ? options['init'] : undefined
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

            const containers = yield docker.listContainers.$call(docker, {
                all: true,
                filters: JSON.stringify({
                    name: [
                        docker.util.nameFilter(appName)
                    ]
                })
            });

            for (let data of containers) {
                const parts = data['Names'][0].substr(1).split('.');
                if (-1 == services.indexOf(parts[0])) {
                    services.push(parts[0]);
                }
            }
        }

        const containers = {};
        const extraHosts = yield getExtraHosts.$call(null, docker, appName);

        for (let name of services) {
            let container = docker.getContainer(name + '.' + appName);

            let info = null;
            try {
                info = yield container.inspect.$call(container);
            } catch (e) {}

            let needStart = true;
            if (info) {
                if (info['State']['Running']) {
                    needStart = false;
                    console.warn('');
                    console.warn('[%s] Container "%s.%s" already running.', process.pid, name, appName);
                } else {
                    let waitMode = 'noninteractive';
                    if (info['Config']['Labels'] && info['Config']['Labels']['whaler.wait']) {
                        if (process.env.WHALER_WAIT_MODE) {
                            waitMode = process.env.WHALER_WAIT_MODE;
                        } else if ('interactive' === process.env.WHALER_FRONTEND && process.stdout.isTTY) {
                            waitMode = 'interactive';
                        }
                    }

                    let needRebuild = false;
                    if ('interactive' === waitMode) {
                        if (!info['Config']['Tty']) {
                            needRebuild = true;
                            console.warn('');
                            console.warn('[%s] Rebuild container "%s.%s" to interactive mode.', process.pid, name, appName);
                        }
                    } else {
                        if (info['Config']['Tty']) {
                            needRebuild = true;
                            console.warn('');
                            console.warn('[%s] Rebuild container "%s.%s" to non-interactive mode.', process.pid, name, appName);
                        }
                    }

                    if (needRebuild) {
                        needStart = false;
                        yield whaler.$emit('rebuild', {
                            ref: name + '.' + appName
                        });
                    }
                }

            } else {
                const result = yield whaler.$emit('create', {
                    ref: name + '.' + appName
                });
                container = result[name];
            }

            if (needStart) {
                console.info('');
                console.info('[%s] Starting "%s.%s" container.', process.pid, name, appName);

                info = yield container.inspect.$call(container);

                const startOpts = info['HostConfig'];
                startOpts['ExtraHosts'] = extraHosts;

                let wait = false;
                if (info['Config']['Labels'] && info['Config']['Labels']['whaler.wait']) {
                    wait = str2time(info['Config']['Labels']['whaler.wait']);
                }

                if (info['LogPath']) {
                    yield fs.truncate.$call(null, info['LogPath'], 0);
                }

                var data = yield container.start.$call(container, startOpts);

                injectIps.$call(null, docker, appName);

                if (wait) {
                    let stream = null;
                    let revertResize = function () {};
                    let attachStdin = info['Config']['AttachStdin'];
                    let tty = info['Config']['Tty'];

                    if (tty) {
                        stream = yield container.attach.$call(container, {
                            stream: true,
                            stdin: true,
                            stdout: true,
                            stderr: true
                        });
                        revertResize = docker.util.resizeTTY(container);

                    } else {
                        stream = yield container.logs.$call(container, {
                            follow: true,
                            stdout: true,
                            stderr: true
                        });
                    }

                    const revertPipe = pipe(whaler, stream, attachStdin);

                    whaler.before('SIGINT', function* () {
                        revertPipe();
                        revertResize();
                    });

                    yield writeLogs.$call(null, docker, stream, wait, tty);

                    revertPipe();
                    revertResize();
                }

                info = yield container.inspect.$call(container);

                console.info('');
                console.info('[%s] Container "%s.%s" started.', process.pid, name, appName);
            }

            extraHosts.push(name + ':' + info['NetworkSettings']['IPAddress']);

            containers[name] = container;
        }

        return containers;
    });

}

/**
 * @param whaler
 * @param stream
 * @param attachStdin
 * @returns {Function}
 */
function pipe(whaler, stream, attachStdin) {

    let unpipeStream = function() {
        if (stream) {
            if (stream.end) {
                stream.end();
            } else if (stream.socket) {
                if (stream.socket.end) {
                    stream.socket.end();
                }
            }
        }
    };

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

/**
 * @param docker
 * @param stream
 * @param wait
 * @param tty
 * @param callback
 */
function writeLogs(docker, stream, wait, tty, callback) {
    let timeoutId = setTimeout(() => {
        callback(null);
    }, wait);

    let firstStr = true;
    const stdout = {
        write: (data) => {
            if ('string' !== typeof data) {
                data = data.toString('utf8');
            }

            if (firstStr) {
                firstStr = false;
                if (!('\r\n' === data || '\n' === data)) {
                    console.log('');
                }
            }

            const sleepTime = processStdoutWrite(data);
            if (null !== sleepTime) {
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
        let firstStr = true;
        docker.modem.demuxStream(stream, stdout, process.stderr);
    }
}

/**
 * @param data
 * @returns {*}
 */
function processStdoutWrite(data) {
    if (-1 !== data.indexOf('@whaler ready in') || -1 !== data.indexOf('@whaler wait')) {
        const sleepTime = str2time(data);
        console.info('');
        console.info('[%s] Waiting %ss to make sure container is started.', process.pid, sleepTime / 1000);

        if (-1 !== data.indexOf('@whaler ready in')) {
            console.warn('');
            console.warn('[%s] "@me ready in" is deprecated, please use "@whaler wait" instead.', process.pid);
        }

        return sleepTime;

    } else {
        process.stdout.write(data);
    }

    return null;
}

/**
 * @param docker
 * @param appName
 */
function* injectIps(docker, appName) {
    let containers;
    try {
        containers = yield docker.listContainers.$call(docker, {
            all: false,
            filters: JSON.stringify({
                name: [
                    docker.util.nameFilter(appName)
                ]
            })
        });
    } catch (e) {}

    if (!containers) {
        return;
    }

    const hosts = [];
    const values = [];
    const domains = [];

    for (let data of containers) {
        const parts = data['Names'][0].substr(1).split('.');
        try {
            const container = docker.getContainer(data['Id']);
            const info = yield container.inspect.$call(container);
            hosts.push(info['HostsPath']);
            domains.push(parts[0]);
            values.push(info['NetworkSettings']['IPAddress'] + '\t' + parts[0] + '\n');
        } catch (e) {}
    }

    const re = new RegExp('([0-9\\.])+\\s+(' + domains.map((value) => {
        return value.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }).join('|') + ')\\n', 'g');

    for (let hostsPath of hosts) {
        fs.readFile(hostsPath, 'utf-8', (err, data) => {
            if (!err) {
                data = data.replace(re, '') + values.join('');
                fs.writeFile(hostsPath, data, 'utf-8', (err) => {});
            }
        });
    }
}

function* getExtraHosts(docker, appName) {
    let containers;
    try {
        containers = yield docker.listContainers.$call(docker, {
            all: false,
            filters: JSON.stringify({
                name: [
                    docker.util.nameFilter(appName)
                ]
            })
        });
    } catch (e) {}

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

    return extraHosts;
}
