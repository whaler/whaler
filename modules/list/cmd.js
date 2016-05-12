'use strict';

var pkg = require('./package.json');
var console = require('x-console');

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

            const table = whaler.get('cli-table')({
                head: [ 'Application name', 'Env', 'Status', 'Path' ]
            });

            console.log('');
            console.log(table.render(response));
        });

}
