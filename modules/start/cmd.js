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
            ref: 'Application or container name'
        })
        .option('--init [CONFIG]', 'Initialize application if not exist yet')
        .action(function* (ref, options) {
            ref = this.util.prepare('ref', ref);
            if (options.init && 'string' === typeof options.init) {
                options.init = this.util.prepare('path', options.init);
            }

            const containers = yield whaler.$emit('start', {
                ref: ref,
                init: options.init
            });
        });

}
