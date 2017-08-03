'use strict';

var pkg = require('./package.json');
var console = require('x-console');
var colors = require('colors/safe');

module.exports = cmd;

/**
 * @param whaler
 */
function cmd(whaler) {

    whaler.get('cli')
        .command(pkg.name)
        .description(pkg.description)
        .option('-f, --format <FORMAT>', 'The output format (txt or json) [default: "txt"]')
        .action(function* (options) {
            const response = yield whaler.$emit('list');

            if ('json' == options.format) {
                this.ignoreEndLine(true);
                console.log(JSON.stringify(response, null, 2));
            } else {
                const table = whaler.get('cli-table')({
                    head: [ 'Application name', 'Env', 'Status', 'Path' ]
                });

                const data = [];
                for (let app of response) {
                    const status = [];
                    for (let service of app.services) {
                        let value = '~';
                        const color = service.volatile ? 'red' : null;
                        if ('ON' == service.status) {
                            value = '+';
                        } else if ('OFF' == service.status) {
                            value = '-';
                        }
                        status.push(color ? colors[color](value) : value);
                    }

                    data.push([app.name, app.env, status.join('|'), app.path || '']);
                }

                console.log('');
                console.log(table.render(data));
            }
        });

}
