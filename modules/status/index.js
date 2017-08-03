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

        const services = Object.keys(app.config['data']['services']);

        let containers = yield docker.listContainers.$call(docker, {
            all: true,
            filters: JSON.stringify({
                name: [
                    docker.util.nameFilter(options['name'])
                ]
            })
        });

        containers = containers.filter((data) => {
            const parts = data['Names'][0].substr(1).split('.');
            return -1 == services.indexOf(parts[0]);
        }).map((data) => {
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

        const response = [];
        for (let name of services) {
            const container = docker.getContainer(name + '.' + options['name']);

            let ip = null;
            let status = 'NOT CREATED';

            try {
                const info = yield container.inspect.$call(container);
                if (info['State']['Running']) {
                    status = 'ON';
                    ip = info['NetworkSettings']['Networks']['bridge']['IPAddress'];
                } else {
                    status = 'OFF';
                }
            } catch (e) {}

            response.push({
                name: name,
                status: status,
                ip: ip,
                volatile: !app.config['data']['services'][name]
            });
        }

        return response;
    });

}
