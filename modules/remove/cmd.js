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
        .option('--purge', 'Completely remove a [ref] and the associated configuration files')
        .action(function* (ref, options) {
            ref = this.util.prepare('ref', ref);

            yield whaler.$emit('remove', {
                ref: ref,
                purge: options.purge
            });
        });

}
