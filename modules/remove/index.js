'use strict';

var fs = require('fs');
var console = require('x-console');

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
function exports(whaler) {

    whaler.on('remove', function* (options) {
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
        const services = [];

        if (serviceName) {
            services.push(serviceName);

        } else {
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
                services.push(parts[0]);
            }
        }

        for (let name of services) {
            const container = docker.getContainer(name + '.' + appName);

            console.info('');
            console.info('[%s] Removing "%s.%s" container.', process.pid, name, appName);

            yield container.remove.$call(container, {
                v: true,
                force: true
            });

            console.info('');
            console.info('[%s] Container "%s.%s" removed.', process.pid, name, appName);

            if (options['purge']) {
                const config = app.config['data']['services'][name];
                const imageName = config['image'] || 'whaler_' + appName + '_' + name;

                try {
                    const image = docker.getImage(imageName);
                    yield image.remove.$call(image);

                    console.warn('');
                    console.warn('[%s] Image "%s" removed.', process.pid, imageName);
                } catch (e) {}
            }
        }

        if (options['purge']) {
            if (serviceName) {
                try {
                    yield fs.stat.$call(null, '/var/lib/whaler/volumes/' + appName + '/' + serviceName);
                    yield deleteFolderRecursive.$call(null, '/var/lib/whaler/volumes/' + appName + '/' + serviceName);
                } catch (e) {}

                console.warn('');
                console.warn('[%s] Service "%s" removed.', process.pid, serviceName);

            } else {
                try {
                    yield fs.stat.$call(null, '/var/lib/whaler/volumes/' + appName);
                    yield deleteFolderRecursive.$call(null, '/var/lib/whaler/volumes/' + appName);
                } catch (e) {}

                yield storage.remove.$call(storage, appName);

                console.warn('');
                console.warn('[%s] Application "%s" removed.', process.pid, appName);
            }
        }
    });
}

/**
 * @param path
 */
function* deleteFolderRecursive(path) {
    const data = yield fs.readdir.$call(null, path);
    for (let file of data) {
        const curPath = path + '/' + file;
        const stat = yield fs.lstat.$call(null, curPath);
        if (stat.isDirectory()) {
            yield deleteFolderRecursive.$call(null, curPath);
        } else {
            yield fs.unlink.$call(null, curPath);
        }
    }
    yield fs.rmdir.$call(null, path);
}
