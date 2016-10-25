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

        let stream;

        container.followLogs = function* () {
            const info = yield container.inspect.$call(container);

            stream = yield container.logs.$call(container, {
                follow: true,
                stdout: true,
                stderr: true
            });

            if (info['Config']['Tty']) {
                stream.setEncoding('utf8');
                stream.pipe(process.stdout, { end: true });

            } else {
                docker.modem.demuxStream(stream, process.stdout, process.stderr);
            }
        };

        container.exit = function* () {
            if (stream) {
                if (stream.end) {
                    stream.end();
                } else if (stream.socket) {
                    if (stream.socket.end) {
                        stream.socket.end();
                    }
                }
            }
        };

        return container;
    });

}
