'use strict';

const pkg = require('./package.json');

module.exports = cmd;

/**
 * @param whaler
 */
async function cmd (whaler) {

    await list(whaler);
    await install(whaler);
    await remove(whaler);

}

/**
 * @param whaler
 */
async function list (whaler) {

    (await whaler.fetch('cli')).default

        .command(pkg.name)
        .description('Show installed plugins')
        .option('-f, --format <FORMAT>', 'The output format (txt or json) [default: "txt"]')
        .action(async options => {
            const { default: plugins } = await whaler.fetch('plugins');
            const response = await whaler.emit('plugins');

            if ('json' == options.format) {
                const json = [];
                for (let name of response) {
                    const pkg = await plugins.package(name);
                    json.push({
                        name: name,
                        version: pkg['version']
                    });
                }
                console.log(JSON.stringify(json, null, 2));
            } else {
                const table = (await whaler.fetch('cli-table')).default({
                    head: [ 'Plugin name', 'Version' ]
                });

                const data = [];
                for (let name of response) {
                    const pkg = await plugins.package(name);
                    data.push([ name, pkg['version'] ]);
                }
                console.log('\n' + table.render(data) + '\n');
            }

        })
        .ignoreEndLine(true);

}

/**
 * @param whaler
 */
async function install (whaler) {

    (await whaler.fetch('cli')).default

        .command(pkg.name + ':install <name>')
        .description('Install plugin', {
            name: 'Plugin name or path'
        })
        .action(async (name, options) => {
            console.log('');
            const response = await whaler.emit('plugins:install', { name });
            if (false === response) {
                throw new Error('Can\'t install plugin "' + name + '".');
            }
            whaler.info('Plugin "%s" installed.', response['name']);
        });

}

/**
 * @param whaler
 */
async function remove (whaler) {

    (await whaler.fetch('cli')).default

        .command(pkg.name + ':remove <name>')
        .description('Remove plugin', {
            name: 'Plugin name'
        })
        .action(async (name, options) => {
            const response = await whaler.emit('plugins:remove', { name });
            whaler.info('Plugin "%s" removed.', name);
        });

}
