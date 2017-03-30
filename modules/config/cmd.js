'use strict';

var yaml = require('js-yaml');
var jsDiff = require('diff');
var pkg = require('./package.json');
var console = require('x-console');
var colors = require('colors/safe');

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
        .option('--diff', 'Shows config difference between current and file')
        .option('--update', 'Update config')
        .option('--file <FILE>', 'Specify an config file (default: ./whaler.yml)')
        .option('--set-env <ENV>', 'Set application environment')
        .action(function* (name, options) {
            name = this.util.prepare('name', name);
            if (options.file) {
                options.file = this.util.prepare('path', options.file);
            }

            const config = yield whaler.$emit('config', {
                name: name,
                file: options.file,
                update: options.update,
                setEnv: options.setEnv
            });

            console.log('');
            if (options.update) {
                console.info('[%s] Application "%s" config updated.', process.pid, name);
            } else if (options.setEnv) {
                console.info('[%s] Application "%s" env updated.', process.pid, name);
            } else {
                if (options.diff) {
                    const _config = yield whaler.$emit('config', {
                        name: name,
                        file: options.file ? null : config.file
                    });

                    let config1 = yaml.dump(_config.data, { indent: 2 }) + '\n';
                    let config2 = yaml.dump(config.data, { indent: 2 }) + '\n';

                    if (config1 !== config2) {
                        let diff;
                        if (options.file) {
                            diff = jsDiff.diffLines(config1, config2);
                        } else {
                            diff = jsDiff.diffLines(config2, config1);
                        }

                        diff.forEach((part) => {
                            let value = part['value'].split('\n\n').join('\n');
                            if (part['added']) {
                                process.stdout.write(colors.green(value));
                            } else if (part['removed']) {
                                process.stdout.write(colors.red(value));
                            } else {
                                process.stdout.write(value);
                            }
                        });
                    } else {
                        console.info('[%s] Configs are identical.', process.pid);
                    }

                } else {
                    console.info(config.file, '\n');
                    let data = yaml.dump(config.data, { indent: 2 });
                    console.log(data.trim());
                }
            }
        });

}
