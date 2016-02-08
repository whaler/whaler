'use strict';

var console = require('x-console');

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
function exports(whaler) {

    whaler.on('stop', function* (options) {
        let appName = options['ref'];
        let serviceName = null;

        const parts = options['ref'].split('.');
        if (2 == parts.length) {
            appName = parts[1];
            serviceName = parts[0];
        }

        const docker = whaler.get('docker');
        const storage = whaler.get('apps');
        const app = yield storage.get.$call(storage, appName);
        const containers = {};
        const services = [];

        if (serviceName) {
            services.push(serviceName);

        } else {
            const containers = yield docker.listContainers.$call(docker, {
                all: false,
                filters: JSON.stringify({
                    name: [
                        docker.util.nameFilter(appName)
                    ]
                })
            });

            for (let data of containers) {
                const parts = data['Names'][0].substr(1).split('.');
                services.push(parts[0]);
            }
        }

        for (let name of services) {
            const container = docker.getContainer(name + '.' + appName);

            const info = yield container.inspect.$call(container);

            if (!info['State']['Running']) {
                console.warn('');
                console.warn('[%s] Container "%s.%s" already stopped.', process.pid, name, appName);

            } else {
                console.info('');
                console.info('[%s] Stopping "%s.%s" container.', process.pid, name, appName);

                yield container.stop.$call(container, {});

                console.info('');
                console.info('[%s] Container "%s.%s" stopped.', process.pid, name, appName);
            }

            containers[name] = container;
        }

        return containers;
    });

}
