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

            const services = yield whaler.$emit('status', {
                name: appName
            });

            response.push({
                name: appName,
                env: app.env,
                path: app.path,
                services: services
            });
        }

        return response;
    });

}
