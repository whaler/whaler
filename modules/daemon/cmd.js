'use strict';

var pkg = require('./package.json');
var console = require('x-console');

module.exports = cmd;

/**
 * @param whaler
 */
function cmd(whaler) {

    whaler.get('cli')
        .command(pkg.name)
        .description(pkg.description)
        .option('--port <PORT>', 'Port to use')
        .action(function* (options) {
            let port = 1337;
            if (options.port) {
                port = options.port;
            }

            const daemon = yield whaler.$emit('daemon', {
                dir: process.env.HOME + '/apps'
            });

            whaler.before('SIGINT', function* () {
                daemon.close();
            });

            daemon.listen(port, () => {
                console.warn('[%s] Daemon start listening %s port.', process.pid, port);
            });
        });

}
