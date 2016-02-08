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
        .option('--config <CONFIG>', 'Config to use')
        .action(function* (ref, options) {
            ref = this.util.prepare('ref', ref);
            if (options.config) {
                options.config = this.util.prepare('path', options.config);
            }

            const containers = yield whaler.$emit('create', {
                ref: ref,
                config: options.config
            });
        });

}
