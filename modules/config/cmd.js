'use strict';

const yaml = require('js-yaml');
const jsDiff = require('diff');
const pkg = require('./package.json');
const colors = require('colors/safe');

module.exports = cmd;

/**
 * @param whaler
 */
async function cmd (whaler) {

    (await whaler.fetch('cli')).default

        .command(pkg.name + ' [name]')
        .description(pkg.description, {
            name: 'Application name'
        })
        .option('--diff', 'Shows config difference between current and file')
        .option('--update', 'Update config')
        .option('--file <FILE>', 'Specify an config file (default: ./whaler.yml)')
        .option('--set-env <ENV>', 'Set application environment')
        .action(async (name, options, util) => {
            name = util.prepare('name', name);
            if (options.file) {
                options.file = util.prepare('path', options.file);
            }

            const config = await whaler.emit('config', {
                name,
                ...util.filter(options, ['file', 'update', 'setEnv'])
            });

            const yamlDumpOpts = {
                indent: 4,
                noRefs: false,
                noCompatMode: true
            };

            if (options.update) {
                whaler.info('Application "%s" config updated.', name);
            } else if (options.setEnv) {
                whaler.info('Application "%s" env updated.', name);
            } else {
                if (options.diff) {
                    const _config = await whaler.emit('config', {
                        name,
                        file: options.file ? null : config.file
                    });

                    const config1 = yaml.dump(_config.data, yamlDumpOpts) + '\n';
                    const config2 = yaml.dump(config.data, yamlDumpOpts) + '\n';

                    if (config1 !== config2) {
                        let diff;
                        if (options.file) {
                            diff = jsDiff.diffLines(config1, config2);
                        } else {
                            diff = jsDiff.diffLines(config2, config1);
                        }

                        console.log('');
                        diff.forEach((part) => {
                            const value = part['value'].split('\n\n').join('\n');
                            if (part['added']) {
                                process.stdout.write(colors.green(value));
                            } else if (part['removed']) {
                                process.stdout.write(colors.red(value));
                            } else {
                                process.stdout.write(value);
                            }
                        });
                    } else {
                        whaler.info('Configs are identical.');
                    }

                } else {
                    const env = await whaler.emit('config:env', { name });
                    console.info('\n' + config.file + '~' + env + '\n');
                    console.log(yaml.dump(config.data, yamlDumpOpts).trim());
                }
            }
        });

}
