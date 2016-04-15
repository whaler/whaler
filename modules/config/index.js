'use strict';

var fs = require('fs');
var path = require('path');
var yaml = require('js-yaml');
var util = require('dockerode/lib/util');

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
function exports(whaler) {

    whaler.on('config', function* (options) {
        const storage = whaler.get('apps');

        const app = yield storage.get.$call(storage, options['name']);
        const update = {};

        if (options['setEnv']) {
            app.env = update['env'] = options['setEnv'];
        }

        if (options['update']) {
            update['config'] = yield loadConfig.$call(null, app, options);
        }

        if (Object.keys(update).length > 0) {
            yield storage.update.$call(storage, options['name'], update);
            return update['config'] || app.config;

        } else {
            let config = app.config;
            if (options['config']) {
                config = yield loadConfig.$call(null, app, options);
            }

            return config;
        }
    });

}

// PRIVATE

/**
 * @param app
 * @param options
 * @returns {Object}
 */
function loadConfig(app, options, callback) {
    const file = options['config'] || app.config['file'] || app.path + '/whaler.yml';

    if (!path.isAbsolute(file)) {
        return callback(new Error('Config path must be absolute.'));
    }

    fs.readFile(file, 'utf8', (err, data) => {
        if (err) {
            return callback(err);
        }

        data = data.replace('[app_path]', app.path);
        data = yaml.load(data);

        callback(null, {
            file: file,
            data: prepareConfig(data, app.env)
        });
    });
}

/**
 * @param config
 * @param env
 * @returns {Object}
 */
function prepareConfig(config, env) {
    config = prepareConfigEnv(config, env);
    for (let key in config) {
        if (config[key]['extend']) {
            config[key] = util.extend({}, config[config[key]['extend']], config[key]);
            delete config[key]['extend'];
        }

        if (config[key]['volumes'] && !Array.isArray(config[key]['volumes'])) {
            const volumes = [];
            for (let v in config[key]['volumes']) {
                volumes.push(v + ':' + config[key]['volumes'][v]);
            }
            config[key]['volumes'] = volumes;
        }

        if (config[key]['env'] && !Array.isArray(config[key]['env'])) {
            const env = [];
            for (let e in config[key]['env']) {
                env.push(e + '=' + config[key]['env'][e]);
            }
            config[key]['env'] = env;
        }

        if (config[key]['wait'] && 'string' !== typeof config[key]['wait']) {
            config[key]['wait'] = config[key]['wait'] + 's';
        }
    }

    return config;
}

/**
 * @param config
 * @param env
 * @returns {Object}
 */
function prepareConfigEnv(config, env) {
    if ('object' === typeof config && null !== config && Object.keys(config).length) {
        const keys = Object.keys(config);
        for (let key of keys) {
            if ('~' == key[0]) {
                if ('~' + env == key) {
                    config = util.extend({}, config, config[key]);
                }
                delete config[key];
                config = prepareConfigEnv(config, env);
            } else {
                config[key] = prepareConfigEnv(config[key], env);
            }
        }
    }

    return config;
}
