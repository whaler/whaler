'use strict';

var pkg = require('./package.json');

module.exports = cmd;

/**
 * @param whaler
 */
function cmd(whaler) {

    whaler.get('cli')
        .command(pkg.name + ' [ref]')
        .description(pkg.description, {
            ref: 'Container name'
        })
        .action(function* (ref, options) {
            ref = this.util.prepare('ref', ref);

            const stream = yield whaler.$emit('logs', {
                ref: ref
            });

            whaler.before('SIGINT', function* () {
                stream.socket.end();
            });

            stream.setEncoding('utf8');
            stream.pipe(process.stdout, { end: true });
        });

}
