'use strict';

const fs = require('fs').promises;

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
async function exports (whaler) {

    whaler.on('remove', async ctx => {
        let appName = ctx.options['ref'];
        let serviceName = null;

        const parts = ctx.options['ref'].split('.');
        if (2 == parts.length) {
            appName = parts[1];
            serviceName = parts[0];
        }

        const { default: docker } = await whaler.fetch('docker');
        const { default: storage } = await whaler.fetch('apps');
        const app = await storage.get(appName);

        let services = Object.keys(app.config['data']['services']);

        if (serviceName) {
            services = [serviceName];

        } else {
            const containers = await docker.listContainers({
                all: true,
                filters: JSON.stringify({
                    name: [
                        docker.util.nameFilter(appName)
                    ]
                })
            });

            for (let data of containers) {
                const parts = data['Names'][0].substr(1).split('.');
                if (-1 === services.indexOf(parts[0])) {
                    services.push(parts[0]);
                }
            }
        }

        for (let name of services) {
            const container = docker.getContainer(name + '.' + appName);

            whaler.info('Removing "%s.%s" container.', name, appName);

            try {
                await container.remove({
                    v: true,
                    force: true
                });

                whaler.info('Container "%s.%s" removed.', name, appName);
            } catch (e) {
                whaler.warn('Container "%s.%s" already removed.', name, appName);
            }

            if (ctx.options['purge']) {
                const config = app.config['data']['services'][name];
                if (config) {
                    const imageName = config['image'] || 'whaler_' + appName + '_' + name;

                    try {
                        const image = docker.getImage(imageName);
                        await image.remove();

                        whaler.warn('Image "%s" removed.', imageName);
                    } catch (e) {}
                }
            }
        }

        if (null === serviceName) {
            try {
                const appNetwork = docker.getNetwork('whaler_nw.' + appName);
                await appNetwork.remove({});
            } catch (e) {}
        }

        if (ctx.options['purge']) {
            if (serviceName) {
                try {
                    await fs.stat('/var/lib/whaler/volumes/' + appName + '/' + serviceName);
                    await deleteFolderRecursive('/var/lib/whaler/volumes/' + appName + '/' + serviceName);
                } catch (e) {}

                whaler.warn('Service "%s" removed.', serviceName);

            } else {
                try {
                    await fs.stat('/var/lib/whaler/volumes/' + appName);
                    await deleteFolderRecursive('/var/lib/whaler/volumes/' + appName);
                } catch (e) {}

                // remove named volumes
                const volumesList = await docker.listVolumes({
                    filters: JSON.stringify({
                        name: [
                            '^whaler_vlm[\.]{1}' + appName + '[\.]{1}[a-z0-9\-]+$'
                        ]
                    })
                });
                if (volumesList['Volumes']) {
                    for (let rmVolume of volumesList['Volumes']) {
                        let appVolume = docker.getVolume(rmVolume['Name']);
                        await appVolume.remove({
                            force: true
                        });
                    }
                }

                await storage.remove(appName);

                whaler.warn('Application "%s" removed.', appName);
            }
        }
    });
}

/**
 * @param path
 */
async function deleteFolderRecursive (path) {
    const data = await fs.readdir(path);
    for (let file of data) {
        const curPath = path + '/' + file;
        const stat = await fs.lstat(curPath);
        if (stat.isDirectory()) {
            await deleteFolderRecursive(curPath);
        } else {
            await fs.unlink(curPath);
        }
    }
    await fs.rmdir(path);
}
