'use strict';

var pkg = require('./package.json');
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
        .action(function* (name, options) {
            name = this.util.prepare('name', name);

            const response = yield whaler.$emit('status', {
                name: name
            });

            const table = whaler.get('cli-table')({
                head: [ 'Container name', 'Status', 'IP' ]
            });

            console.log('');
            console.log(table.render(response));
        });

}
