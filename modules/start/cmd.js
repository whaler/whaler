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
        .option('--init [INIT]', 'Initialize application if not exist yet.')
        .action(async (ref, options, util) => {
            ref = util.prepare('ref', ref);

            if (options.init) {
                if ('string' === typeof options.init) {
                    let [ config, env ] = options.init.split(/[~]+/);

                    if (config) {
                        config = util.prepare('path', config);
                    }

                    options.init = { config, env };
                } else {
                    options.init = {};
                }
            }

            await whaler.emit('start', { ref, ...util.filter(options, ['init']) });
        });

}
