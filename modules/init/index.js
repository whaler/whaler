'use strict';

var path = require('path');

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
function exports(whaler) {

    whaler.on('init', function* (options) {
        const storage = whaler.get('apps');
        options['path'] = options['path'] || process.cwd();

        if (!path.isAbsolute(options['path'])) {
            throw new Error('App path must be absolute.');
        }

        const app = yield storage.add.$call(storage, options['name'], {
            path: options['path'],
            env:  options['env'] || process.env.WHALER_ENV || 'dev',
            config: {}
        });

        try {
            app['config'] = yield whaler.$emit('config', {
                name: options['name'],
                config: options['config'],
                update: true
            });

            return app;

        } catch (e) {
            yield storage.remove.$call(storage, options['name']);
            throw e;
        }
    });

}
