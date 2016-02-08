'use strict';

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
function exports(whaler) {

    whaler.on('rebuild', function* (options) {
        yield whaler.$emit('remove', options);
        return yield whaler.$emit('start', options);
    });

}
