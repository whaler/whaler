'use strict';

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
function exports(whaler) {

    whaler.on('restart', function* (options) {
        yield whaler.$emit('stop', options);
        return yield whaler.$emit('start', options);
    });

}
