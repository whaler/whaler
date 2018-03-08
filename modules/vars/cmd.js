'use strict';

const pkg = require('./package.json');

module.exports = cmd;

/**
 * @param whaler
 */
async function cmd (whaler) {

    await list(whaler);
    await set(whaler);
    await unset(whaler);

}

/**
 * @param whaler
 */
async function list (whaler) {

        (await whaler.fetch('cli')).default

        .command(pkg.name)
        .description('Show vars')
        .option('-f, --format <FORMAT>', 'The output format (txt or json) [default: "txt"]')
        .action(async (options) => {
            const vars = await whaler.emit('vars');

            if ('json' == options.format) {
                console.log(JSON.stringify(vars, null, 2));
            } else {
                const table = (await whaler.fetch('cli-table')).default({
                    head: [ 'Name', 'Value' ]
                });

                for (let key in vars) {
                    let value = vars[key];
                    if (!value) {
                        value = '';
                    }
                    table.push([ key, value ]);
                }

                console.log('\n' + table.render() + '\n');
            }

        })
        .ignoreEndLine(true);

}

/**
 * @param whaler
 */
async function set (whaler) {

    (await whaler.fetch('cli')).default

        .command(pkg.name + ':set <name> [value]')
        .description('Set var', {
            'name': 'Var name',
            'value': 'Var value'
        })
        .action(async (name, value, options) => {
            await whaler.emit('vars:set', { name, value });
            whaler.info('Set %s=%s', name, value);
        });

}

/**
 * @param whaler
 */
async function unset (whaler) {

    (await whaler.fetch('cli')).default

        .command(pkg.name + ':unset <name>')
        .description('Unset var', {
            'name': 'Var name'
        })
        .action(async (name, options) => {
            await whaler.emit('vars:unset', { name });
            whaler.info('Unset %s', name);
        });

}
