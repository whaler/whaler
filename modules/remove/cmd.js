'use strict';

const pkg = require('./package.json');

module.exports = cmd;

/**
 * @param whaler
 */
async function cmd (whaler) {

    (await whaler.fetch('cli')).default

        .command(pkg.name + ' [ref]')
        .description(pkg.description, {
            ref: 'Application or container name'
        })
        .option('--purge', 'Completely remove a [ref] and the associated configuration files')
        .action(async (ref, options, util) => {
            ref = util.prepare('ref', ref);
            await whaler.emit('remove', { ref, ...util.filter(options, ['purge']) });
        });

}
