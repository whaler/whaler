'use strict';

var pkg = require('./package.json');

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
        .action(function* (ref, options) {
            ref = this.util.prepare('ref', ref);

            const container = yield whaler.$emit('logs', {
                ref: ref
            });

            whaler.before('SIGINT', function* () {
                yield container.exit.$call(null);
            });

            yield container.followLogs.$call(null);

        });

}
