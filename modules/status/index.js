'use strict';

var colors = require('colors/safe');

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
function exports(whaler) {

    whaler.on('status', function* (options) {
        const docker = whaler.get('docker');
        const storage = whaler.get('apps');
        const app = yield storage.get.$call(storage, options['name']);

        const response = [];
        const services = Object.keys(app.config['data']['services']);

        const containers = yield docker.listContainers.$call(docker, {
            all: true,
            filters: JSON.stringify({
                name: [
                    docker.util.nameFilter(options['name'])
                ]
            })
        });

        for (let data of containers) {
            const parts = data['Names'][0].substr(1).split('.');
            if (-1 == services.indexOf(parts[0])) {
                services.push(parts[0]);
            }
        }

        let message = null;
        for (let name of services) {
            const container = docker.getContainer(name + '.' + options['name']);

            let ip = '-';
            let status = 'NOT CREATED';
            const color = app.config['data']['services'][name] ? null : 'red';

            if (color && !message) {
                message = colors[color]('*') + ' Volatile container, will be removed on app rebuild.';
            }

            try {
                const info = yield container.inspect.$call(container);
                if (info['State']['Running']) {
                    status = 'ON';
                    ip = info['NetworkSettings']['IPAddress'];
                } else {
                    status = 'OFF';
                }
            } catch (e) {}

            const appName = name + '.' + options['name'];
            response.push([
                color ? colors[color]('*') + ' ' + appName : appName,
                status,
                ip
            ]);
        }

        return {
            table: response,
            message: message,
        };
    });

}
