'use strict';

var pkg = require('./package.json');
var console = require('x-console');

module.exports = cmd;

/**
 * @param whaler
 */
function cmd(whaler) {

    list(whaler);
    install(whaler);
    remove(whaler);

}

/**
 * @param whaler
 */
function list(whaler) {

    whaler.get('cli')
        .command(pkg.name)
        .description('Show installed plugins')
        .option('-f, --format <FORMAT>', 'The output format (txt or json) [default: "txt"]')
        .action(function* (options) {
            const plugins = whaler.get('plugins');
            const response = yield whaler.$emit('plugins');

            if ('json' == options.format) {
                this.ignoreEndLine(true);
                const json = [];
                for (let name of response) {
                    const pkg = plugins.require(name + '/package.json');
                    json.push({
                        name: name,
                        version: pkg['version']
                    });
                }
                console.log(JSON.stringify(json, null, 2));
            } else {
                const table = whaler.get('cli-table')({
                    head: [ 'Plugin name', 'Version' ]
                });

                for (let name of response) {
                    const pkg = plugins.require(name + '/package.json');
                    table.push([ name, pkg['version'] ]);
                }

                console.log('');
                console.log(table.render());
            }

        });

}

/**
 * @param whaler
 */
function install(whaler) {

    whaler.get('cli')
        .command(pkg.name + ':install <name>')
        .description('Install plugin', {
            name: 'Plugin name or path'
        })
        .action(function* (name, options) {
            const response = yield whaler.$emit('plugins:install', {
                name: name
            });

            if (false === response) {
                throw new Error('Can\'t install plugin "' + name + '".');
            }

            console.log('');
            console.info('[%s] Plugin %s installed.', process.pid, response['name']);
        });

}

/**
 * @param whaler
 */
function remove(whaler) {

    whaler.get('cli')
        .command(pkg.name + ':remove <name>')
        .description('Remove plugin', {
            name: 'Plugin name'
        })
        .action(function* (name, options) {
            const response = yield whaler.$emit('plugins:remove', {
                name: name
            });

            console.log('');
            console.info('[%s] Plugin %s removed.', process.pid, name);
        });

}
