'use strict';

var pkg = require('./package.json');
var console = require('x-console');
var Table = require('cli-table');

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
        .action(function* (name, options) {
            name = this.util.prepare('name', name);

            const response = yield whaler.$emit('status', {
                name: name
            });

            const table = new Table({
                head: [
                    'Container name',
                    'Status',
                    'IP'
                ],
                style : {
                    head: [ 'cyan' ]
                }
            });
            for (let data of response) {
                table.push(data);
            }

            console.log('');
            console.log(table.toString());
        });

}
