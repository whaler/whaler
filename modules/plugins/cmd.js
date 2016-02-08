'use strict';

var pkg = require('./package.json');
var console = require('x-console');
var Table = require('cli-table');

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
        .action(function* (options) {
            const response = yield whaler.$emit('plugins');

            const table = new Table({
                head: [
                    'Plugin name'
                ],
                style : {
                    head: [ 'cyan' ]
                }
            });
            for (let name of response) {
                table.push([name]);
            }

            console.log('');
            console.log(table.toString());
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
