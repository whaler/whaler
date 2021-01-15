'use strict';

const pkg = require('./package.json');

module.exports = cmd;

/**
 * @param whaler
 */
async function cmd (whaler) {

    (await whaler.fetch('cli')).default

        .command(pkg.name)
        .description(pkg.description)
        .option('--port <PORT>', 'Port to use')
        .action(async options => {
            let port = 1337;
            if (options.port) {
                port = options.port;
            }

            const daemon = await whaler.emit('daemon', {
                dir: process.env.WHALER_DAEMON_APPS || process.env.HOME + '/apps'
            });

            whaler.before('kill', async ctx => {
                daemon.close();
            });

            daemon.listen(port, () => {
                whaler.warn('Daemon start listening %s port.', port);
                daemon.initListeners().catch((err) => {
                    if (err) {
                        whaler.error('%s\n', err.message);
                    }
                });
            });
        })
        .ignoreOutEndLine(true);

}
