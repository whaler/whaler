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
        .action(async (ref, options, util) => {
            ref = util.prepare('ref', ref);
            await whaler.emit('stop', { ref });
        });

}
