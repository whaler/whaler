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
        .option('--config <CONFIG>', 'Specify an config file')
        .action(async (ref, options, util) => {
            ref = util.prepare('ref', ref);
            if (options.config) {
                options.config = util.prepare('path', options.config);
            }

            await whaler.emit('create', {
                ref,
                ...util.filter(options, ['config'])
            });
        });

}
