'use strict';

const pkg = require('./package.json');
const colors = require('colors/safe');

module.exports = cmd;

async function cmd (whaler) {

    (await whaler.fetch('cli')).default

        .command(pkg.name)
        .description(pkg.description)
        .option('-f, --format <FORMAT>', 'The output format (txt or json) [default: "txt"]')
        .action(async options => {
            const response = await whaler.emit('list');

            if ('json' == options.format) {
                console.log(JSON.stringify(response, null, 2));
            } else {
                const table = (await whaler.fetch('cli-table')).default({
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
                console.log('\n' + table.render(data) + '\n');
            }
        })
        .ignoreEndLine(true);

}
