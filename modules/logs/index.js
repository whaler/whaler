'use strict';

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
async function exports (whaler) {

    whaler.on('logs', async ctx => {
        const { default: docker } = await whaler.fetch('docker');
        const container = docker.getContainer(ctx.options['ref']);

        let stream;

        container.followLogs = async() => {
            const info = await container.inspect();

            stream = await container.logs({
                follow: true,
                stdout: true,
                stderr: true,
                since: ctx.options['since'] || 0,
                tail: ctx.options['tail'] || 'all'
            });

            if (info['Config']['Tty']) {
                stream.setEncoding('utf8');
                stream.pipe(process.stdout, { end: true });

            } else {
                docker.modem.demuxStream(stream, process.stdout, process.stderr);
            }
        };

        container.exit = async () => {
            if (stream) {
                if (stream.end) {
                    stream.end();
                }
                if (stream.destroy) {
                    stream.destroy();
                }
            }
        };

        ctx.result = container;
    });

}
