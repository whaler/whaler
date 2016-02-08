'use strict';

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
function exports(whaler) {

    whaler.on('vars', function* () {
        const vars = whaler.get('vars');
        return yield vars.all.$call(vars);
    });

    whaler.on('vars:set', function* (options) {
        const vars = whaler.get('vars');
        return yield vars.set.$call(vars, options['name'], options['value']);
    });

    whaler.on('vars:unset', function* (options) {
        const vars = whaler.get('vars');
        return yield vars.unset.$call(vars, options['name']);
    });

}
