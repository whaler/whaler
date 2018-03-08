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
        .option('--init [CONFIG]', 'Initialize application if not exist yet')
        .action(async (ref, options, util) => {
            ref = util.prepare('ref', ref);
            if (options.init && 'string' === typeof options.init) {
                options.init = util.prepare('path', options.init);
            }
            await whaler.emit('start', { ref, ...util.filter(options, ['init']) });
        });

}
