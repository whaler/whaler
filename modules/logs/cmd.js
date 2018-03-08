'use strict';

const pkg = require('./package.json');
const str2time = require('../../lib/str2time');

module.exports = cmd;

/**
 * @param whaler
 */
async function cmd (whaler) {

    (await whaler.fetch('cli')).default

        .command(pkg.name + ' [ref]')
        .description(pkg.description, {
            ref: 'Container name'
        })
        .option('--since <SINCE>', 'Show logs since timestamp (e.g. 2017-05-12T14:40:00) or relative (e.g. 42m for 42 minutes)')
        .option('--tail <TAIL>', 'Number of lines to show from the end of the logs (default: all)')
        .action(async (ref, options, util) => {
            ref = util.prepare('ref', ref);

            let since = options['since'] || 0;
            let now = Math.floor(new Date().getTime() / 1000);

            if (parseInt(since).toString() === since.toString()) {
                // do nothing
            } else {
                if (!isNaN(Date.parse(since))) {
                    since = new Date(since).getTime() / 1000;
                } else {
                    since = now - (str2time(since) / 1000);
                }
            }

            const container = await whaler.emit('logs', { ref, since, ...util.filter(options, ['tail']) });

            whaler.before('SIGINT', async ctx => {
                await container.exit();
            });

            await container.followLogs();
        })
        .ignoreEndLine(true);

}
