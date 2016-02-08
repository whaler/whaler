'use strict';

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
function exports(whaler) {

    whaler.on('logs', function* (options) {
        const docker = whaler.get('docker');
        const container = docker.getContainer(options['ref']);

        return yield container.logs.$call(container, {
            follow: true,
            stdout: true,
            stderr: true
        });
    });

}
