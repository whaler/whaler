'use strict';

var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');

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

        if (process.env.WHALER_DAEMON_NAME) {
            let dir = process.env.WHALER_DAEMON_DIR;

            if (dir !== options['path']) {
                dir = path.join(dir, path.basename(options['path']));
            } else {
                if (path.basename(options['path']) !== options['name']) {
                    dir = path.join(dir, options['name']);
                } else {
                    dir = path.join(dir, process.env.WHALER_DAEMON_NAME);
                }
            }

            options['path'] = dir;
            if (options['config']) {
                options['config'] = options['config'].replace(process.env.WHALER_DAEMON_DIR, dir);
            } else {
                options['config'] = path.join(dir, 'whaler.yml');
            }

            try {
                yield fs.stat.$call(null, dir);
            } catch (e) {
                yield mkdirp.$call(null, path.dirname(options['config']));
                yield fs.writeFile.$call(null, options['config'], '');
            }
        }

        const app = yield storage.add.$call(storage, options['name'], {
            path: options['path'],
            env:  options['env'] || process.env.WHALER_ENV || 'dev',
            config: {}
        });

        try {
            app['config'] = yield whaler.$emit('config', {
                name: options['name'],
                file: options['config'],
                update: true
            });

            return app;

        } catch (e) {
            yield storage.remove.$call(storage, options['name']);
            throw e;
        }
    });

}
