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
        .command(pkg.name)
        .description(pkg.description)
        .action(function* (options) {
            const response = yield whaler.$emit('list');

            const table = new Table({
                head: [
                    'Application name',
                    'Status',
                    'Path'
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
