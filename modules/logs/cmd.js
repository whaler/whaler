'use strict';

var pkg = require('./package.json');
var str2time = require('../../lib/str2time');

module.exports = cmd;

/**
 * @param whaler
 */
function cmd(whaler) {

    whaler.get('cli')
        .command(pkg.name + ' [ref]')
        .description(pkg.description, {
            ref: 'Container name'
        })
        .option('--since <SINCE>', 'Show logs since timestamp (e.g. 2017-05-12T14:40:00) or relative (e.g. 42m for 42 minutes)')
        .option('--tail <TAIL>', 'Number of lines to show from the end of the logs (default: all)')
        .action(function* (ref, options) {
            ref = this.util.prepare('ref', ref);

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

            const container = yield whaler.$emit('logs', {
                ref: ref,
                since: since,
                tail: options.tail
            });

            whaler.before('SIGINT', function* () {
                yield container.exit.$call(null);
            });

            yield container.followLogs.$call(null);

        });

}
