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
        .action(function* (ref, options) {
            ref = this.util.prepare('ref', ref);

            const containers = yield whaler.$emit('stop', {
                ref: ref
            });
        });

}
