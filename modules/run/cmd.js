'use strict';

const pkg = require('./package.json');

module.exports = cmd;

/**
 * @param whaler
 */
async function cmd (whaler) {

    (await whaler.fetch('cli')).default

        .command(pkg.name + ' [ref] [cmd]')
        .description(pkg.description, {
            ref: 'Container name',
            cmd: 'Command to execute'
        })
        .option('-e, --env <ENV>', 'Set environment variables (default [])', (val, memo) => [...memo, val], [])
        .option('-d, --detach', 'Run container in background and print container ID')
        .option('--no-entrypoint', 'Disable entrypoint')
        .option('--non-interactive', 'Run command in non-interactive mode')
        .action(async (ref, cmd, options, util) => {
            ref = util.prepare('ref', ref);
            cmd = cmd || process.env.WHALER_RUN_CMD || '/bin/sh';

            let tty = true;
            let stdin = true;
            if (options.detach || options.nonInteractive || 'interactive' !== process.env.WHALER_FRONTEND || !process.stdout.isTTY) {
                tty = false;
                stdin = false;
            }

            const container = await whaler.emit('run', {
                ref, cmd, tty, stdin,
                ...util.filter(options, ['env', 'detach', 'entrypoint'])
            });

            whaler.before('kill', async ctx => {
                await container.exit();
                process.stdout.write('exit');
            });

            const data = await container.run();

            if (options.detach) {
                console.log(data['Id']);

            } else {
                const CTRL_ALT_C = 137;
                if (CTRL_ALT_C !== data['StatusCode']) {
                    await container.exit();
                }
                process.exitCode = data['StatusCode'];
            }
        })
        .ignoreOutEndLine(true);

}
