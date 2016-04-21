'use strict';

var pkg = require('./package.json');
var console = require('x-console');

module.exports = cmd;

/**
 * @param whaler
 */
function cmd(whaler) {

    whaler.get('cli')
        .command(pkg.name + ' [name] [path]')
        .description(pkg.description, {
            name: 'Application name',
            path: 'Application path'
        })
        .option('-e, --env <ENV>', 'Application environment')
        .option('--config <CONFIG>', 'Config to use')
        .action(function* (name, path, options) {
            name = this.util.prepare('name', name);
            path = this.util.prepare('path', path);
            if (options.config) {
                options.config = this.util.prepare('path', options.config);
            }

            const app = yield whaler.$emit('init', {
                name: name,
                path: path,
                env: options.env,
                config: options.config
            });

            console.log('');
            console.info('[%s] An application with "%s" name created.', process.pid, name);
        });

}
