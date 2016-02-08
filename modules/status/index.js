'use strict';

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
        const services = Object.keys(app.config['data']);

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

        for (let name of services) {
            const container = docker.getContainer(name + '.' + options['name']);

            let ip = '-';
            let status = 'NOT CREATED';
            const color = app.config['data'][name] ? null : 'red';

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
                color ? appName[color] : appName,
                status,
                ip
            ]);
        }

        return response;
    });

}
