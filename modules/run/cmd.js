'use strict';

var pkg = require('./package.json');

module.exports = cmd;

/**
 * @param whaler
 */
function cmd(whaler) {

    whaler.get('cli')
        .command(pkg.name + ' [ref] [cmd]')
        .description(pkg.description, {
            ref: 'Container name',
            cmd: 'Command to execute'
        })
        .option('-d, --detach', 'Run container in background and print container ID')
        .option('--no-entrypoint', 'Disable entrypoint')
        .option('--non-interactive', 'Run command in non-interactive mode')
        .action(function* (ref, cmd, options) {
            ref = this.util.prepare('ref', ref);
            cmd = cmd || process.env.WHALER_RUN_CMD || '/bin/sh';

            let tty = true;
            let stdin = true;
            if (options.detach || options.nonInteractive || 'noninteractive' === process.env.WHALER_FRONTEND || !process.stdout.isTTY) {
                tty = false;
                stdin = false;
            }

            const container = yield whaler.$emit('run', {
                ref: ref,
                cmd: cmd,
                tty: tty,
                stdin: stdin,
                detach: options.detach || false,
                entrypoint: options.entrypoint
            });

            whaler.before('SIGINT', function* () {
                yield container.exit.$call(null);
            });

            const data = yield container.run.$call(null);

            if (options.detach) {
                console.log(data['Id']);

            } else if (137 !== data['StatusCode']) {
                yield container.exit.$call(null);
            }
        })
        .ignoreEndLine(true);

}
