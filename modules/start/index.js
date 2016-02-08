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
            services = Object.keys(app.config['data']);

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

        const extraHosts = [];
        const containers = {};

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
                    const stream = yield container.logs.$call(container, {
                        follow: true,
                        stdout: true,
                        stderr: true
                    });

                    whaler.before('SIGINT', function* () {
                        stream.socket.end();
                    });

                    yield writeLogs.$call(null, stream, wait);
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
 * @param stream
 * @param wait
 * @param callback
 */
function writeLogs(stream, wait, callback) {
    const timeoutId = setTimeout(() => {
        stream.socket.end();
        callback(null);
    }, wait);

    stream.setEncoding('utf8');

    stream.on('data', (data) => {
        if (-1 !== data.indexOf('@whaler ready in') || -1 !== data.indexOf('@whaler wait')) {
            const sleepTime = str2time(data);
            console.info('');
            console.info('[%s] Waiting %ss to make sure container is started.', process.pid, sleepTime / 1000);
            clearTimeout(timeoutId);
            setTimeout(() => {
                stream.socket.end();
                callback(null);
            }, sleepTime);

            if (-1 !== data.indexOf('@whaler ready in')) {
                console.warn('');
                console.warn('[%s] "@me ready in" is deprecated, please use "@whaler wait" instead.', process.pid);
            }

        } else {
            process.stdout.write(data);
        }
    });
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
