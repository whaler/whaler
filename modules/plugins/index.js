'use strict';

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
function exports(whaler) {

    whaler.on('plugins', function* () {
        const plugins = whaler.get('plugins');
        return yield plugins.list.$call(plugins);
    });

    whaler.on('plugins:install', function* (options) {
        const plugins = whaler.get('plugins');
        return yield plugins.install.$call(plugins, options['name']);
    });

    whaler.on('plugins:remove', function* (options) {
        const plugins = whaler.get('plugins');
        return yield plugins.remove.$call(plugins, options['name']);
    });

}
