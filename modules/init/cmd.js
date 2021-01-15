'use strict';

const pkg = require('./package.json');

module.exports = cmd;

/**
 * @param whaler
 */
async function cmd (whaler) {

    (await whaler.fetch('cli')).default

        .command(pkg.name + ' [name] [path]')
        .description(pkg.description, {
            name: 'Application name',
            path: 'Application path'
        })
        .option('-e, --env <ENV>', 'Application environment')
        .option('--config <CONFIG>', 'Config to use')
        .action(async (name, path, options, util) => {
            name = util.prepare('name', name);
            path = util.prepare('path', path);
            if (options.config) {
                options.config = util.prepare('path', options.config);
            }

            await whaler.emit('init', { name, path, ...util.filter(options, ['env', 'config']) });

            whaler.info('An application with `%s` name created.', name);
        });

}
