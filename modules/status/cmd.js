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
        .command(pkg.name + ' [name]')
        .description(pkg.description, {
            name: 'Application name'
        })
        .option('-f, --format <FORMAT>', 'The output format (txt or json) [default: "txt"]')
        .action(function* (name, options) {
            name = this.util.prepare('name', name);

            const response = yield whaler.$emit('status', {
                name: name
            });

            if ('json' == options.format) {
                this.ignoreEndLine(true);
                console.log(JSON.stringify(response, null, 2));
            } else {
                const table = whaler.get('cli-table')({
                    head: [ 'Container name', 'Status', 'IP' ]
                });

                const data = [];
                let message = false;
                for (let service of response) {
                    const color = service.volatile ? 'red' : null;

                    if (color && !message) {
                        message = true;
                    }

                    const appName = name + '.' + service.name;
                    data.push([
                        color ? colors[color]('*') + ' ' + appName : appName,
                        service.status,
                        service.ip || '-'
                    ]);
                }

                console.log('');
                console.log(table.render(data));

                if (message) {
                    console.log('');
                    console.log('  ' + colors[color]('*') + ' Volatile container, will be removed on app rebuild.');
                }
            }

        });

}
