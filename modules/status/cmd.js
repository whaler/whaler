'use strict';

const pkg = require('./package.json');
const colors = require('colors/safe');

module.exports = cmd;

/**
 * @param whaler
 */
async function cmd (whaler) {

    (await whaler.fetch('cli')).default

        .command(pkg.name + ' [name]')
        .description(pkg.description, {
            name: 'Application name'
        })
        .option('-f, --format <FORMAT>', 'The output format (txt or json) [default: "txt"]')
        .action(async (name, options, util) => {
            name = util.prepare('name', name);

            const response = await whaler.emit('status', { name });

            if ('json' == options.format) {
                console.log(JSON.stringify(response, null, 2));
            } else {
                const table = (await whaler.fetch('cli-table')).default({
                    head: [ 'Container name', 'Status', 'IP' ]
                });

                const data = [];
                let message = false;
                for (let service of response) {
                    const color = service.volatile ? colors['red'] : null;

                    if (color && !message) {
                        message = true;
                    }

                    const appName = service.name + '.' + name;
                    data.push([
                        color ? color('*') + ' ' + appName : appName,
                        service.status,
                        service.ip || '-'
                    ]);
                }

                console.log('\n' + table.render(data) + '\n');

                if (message) {
                    console.log('\n  ' + color('*') + ' Volatile container, will be removed on app rebuild.\n');
                }
            }

        })
        .ignoreEndLine(true);

}
