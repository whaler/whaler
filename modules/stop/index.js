'use strict';

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
async function exports (whaler) {

    whaler.on('stop', async ctx => {
        let appName = ctx.options['ref'];
        let serviceName = null;

        const parts = ctx.options['ref'].split('.');
        if (2 == parts.length) {
            appName = parts[1];
            serviceName = parts[0];
        }

        const { default: docker } = await whaler.fetch('docker');
        //const { default: storage } = await whaler.fetch('apps');
        //const app = await storage.get(appName);
        const containers = {};
        const services = [];

        if (serviceName) {
            services.push(serviceName);

        } else {
            const containers = await docker.listContainers({
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

            const info = await container.inspect();

            if (!info['State']['Running']) {
                whaler.warn('Container `%s.%s` already stopped.', name, appName);

            } else {
                whaler.info('Stopping `%s.%s` container.', name, appName);
                await container.stop({});
                whaler.info('Container `%s.%s` stopped.', name, appName);
            }

            containers[name] = container;
        }

        ctx.result = containers;
    });

}
