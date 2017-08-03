'use strict';

var pkg = require('./package.json');
var console = require('x-console');

module.exports = cmd;

/**
 * @param whaler
 */
function cmd(whaler) {

    list(whaler);
    set(whaler);
    unset(whaler);

}

/**
 * @param whaler
 */
function list(whaler) {

    whaler.get('cli')
        .command(pkg.name)
        .description('Show vars')
        .option('-f, --format <FORMAT>', 'The output format (txt or json) [default: "txt"]')
        .action(function* (options) {
            const vars = yield whaler.$emit('vars');

            if ('json' == options.format) {
                this.ignoreEndLine(true);
                console.log(JSON.stringify(vars, null, 2));
            } else {
                const table = whaler.get('cli-table')({
                    head: [ 'Name', 'Value' ]
                });

                for (let key in vars) {
                    let value = vars[key];
                    if (!value) {
                        value = '';
                    }
                    table.push([ key, value ]);
                }

                console.log('');
                console.log(table.render());
            }

        });

}

/**
 * @param whaler
 */
function set(whaler) {

    whaler.get('cli')
        .command(pkg.name + ':set <name> [value]')
        .description('Set var', {
            'name': 'Var name',
            'value': 'Var value'
        })
        .action(function* (name, value, options) {
            const response = yield whaler.$emit('vars:set', {
                name: name,
                value: value
            });

            console.info('');
            console.info('[%s] Set %s=%s', process.pid, name, value);
        });

}

/**
 * @param whaler
 */
function unset(whaler) {

    whaler.get('cli')
        .command(pkg.name + ':unset <name>')
        .description('Unset var', {
            'name': 'Var name'
        })
        .action(function* (name, options) {
            const response = yield whaler.$emit('vars:unset', {
                name: name
            });

            console.info('');
            console.info('[%s] Unset %s', process.pid, name);
        });

}
