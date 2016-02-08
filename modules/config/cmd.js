'use strict';

var pkg = require('./package.json');
var YAML = require('yamljs');
var console = require('x-console');

module.exports = cmd;

/**
 * @param whaler
 */
function cmd(whaler) {

    whaler.get('cli')
        .command(pkg.name + ' [name]')
        .description(pkg.description, {
            name: 'Application name'
        })
        .option('--update', 'Update config')
        .option('--config <CONFIG>', 'Config to use')
        .option('--set-env <ENV>', 'Set application environment')
        .action(function* (name, options) {
            name = this.util.prepare('name', name);
            if (options.config) {
                options.config = this.util.prepare('path', options.config);
            }

            const config = yield whaler.$emit('config', {
                name: name,
                update: options.update,
                config: options.config,
                setEnv: options.setEnv
            });

            console.log('');
            if (options.update) {
                console.info('[%s] Application "%s" config updated.', process.pid, name);
            } else if (options.setEnv) {
                console.info('[%s] Application "%s" env updated.', process.pid, name);
            } else {
                console.info(config.file, '\n');
                let data = YAML.stringify(config.data, 4);
                data = data.replace(/dockerfile: "(.*)\\n"/g, 'dockerfile: |\n        $1');
                data = data.replace(/(\\n)/g, '\n        ');
                console.log(data.trim());
            }
        });

}
