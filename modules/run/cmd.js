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
        .option('--no-tty', 'Disable a pseudo-tty allocation')
        .option('--no-stdin', 'Disable STDIN attaching')
        .option('--no-entrypoint', 'Disable entrypoint')
        .action(function* (ref, cmd, options) {
            ref = this.util.prepare('ref', ref);
            cmd = cmd || process.env.WHALER_RUN_CMD || '/bin/sh';

            let tty = options.tty;
            let stdin = options.stdin;
            if ('noninteractive' === process.env.WHALER_FRONTEND || !process.stdout.isTTY) {
                tty = false;
                stdin = false;
            }

            const container = yield whaler.$emit('run', {
                ref: ref,
                cmd: cmd,
                tty: tty,
                stdin: stdin,
                entrypoint: options.entrypoint
            });

            whaler.before('SIGINT', function* () {
                yield container.exit.$call(null);
            });

            const data = yield container.run.$call(null);

            if (137 !== data['StatusCode']) {
                yield container.exit.$call(null);
            }
        })
        .ignoreEndLine(true);

}
