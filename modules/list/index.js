'use strict';

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
function exports(whaler) {

    whaler.on('list', function* () {
        const docker = whaler.get('docker');
        const storage = whaler.get('apps');
        const apps = yield storage.all.$call(storage);

        const response = [];
        for (let appName in apps) {
            const app = apps[appName];
            const names = Object.keys(app.config['data']['services']);

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
                if (-1 == names.indexOf(parts[0])) {
                    names.push(parts[0]);
                }
            }

            const status = [];
            for (let name of names) {
                const container = docker.getContainer(name + '.' + appName);

                let value = '~';
                const color = app.config['data']['services'][name] ? null : 'red';
                try {
                    const info = yield container.inspect.$call(container);
                    if (info['State']['Running']) {
                        value = '+';
                    } else {
                        value = '-';
                    }
                } catch (e) {}
                status.push(color ? value[color] : value);
            }

            response.push([appName, app.env, status.join('|'), app.path || '']);
        }

        return response;
    });

}
