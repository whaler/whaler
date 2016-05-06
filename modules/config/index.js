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
            if (options['file']) {
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
    const file = options['file'] || app.config['file'] || app.path + '/whaler.yml';

    let cb = function(data) {
        data = data.replace('[app_path]', app.path);
        data = yaml.load(data);

        callback(null, {
            file: file,
            data: prepareConfig(data, app.env)
        });
    };

    if (options['yml']) {
        return cb(options['yml']);
    }

    if (!path.isAbsolute(file)) {
        return callback(new Error('Config path must be absolute.'));
    }

    fs.readFile(file, 'utf8', (err, data) => {
        if (err) {
            return callback(err);
        }
        cb(data);
    });
}

/**
 * @param config
 * @param env
 * @returns {Object}
 */
function prepareConfig(config, env) {
    config = config || {};
    config = prepareConfigEnv(config, env);
    if (config['services'] || null) {
        const services = config['services'];
        for (let key in services) {
            if (services[key]['extend']) {
                services[key] = util.extend({}, services[services[key]['extend']], services[key]);
                delete services[key]['extend'];
            }

            if (services[key]['volumes'] && !Array.isArray(services[key]['volumes'])) {
                const volumes = [];
                for (let v in services[key]['volumes']) {
                    if (services[key]['volumes'][v]) {
                        volumes.push(v + ':' + services[key]['volumes'][v]);
                    } else {
                        volumes.push(v);
                    }
                }
                services[key]['volumes'] = volumes;
            }

            if (services[key]['env'] && !Array.isArray(services[key]['env'])) {
                const env = [];
                for (let e in services[key]['env']) {
                    if (services[key]['env'][e]) {
                        env.push(e + '=' + services[key]['env'][e]);
                    } else {
                        env.push(e);
                    }
                }
                services[key]['env'] = env;
            }

            if (services[key]['wait'] && 'string' !== typeof services[key]['wait']) {
                services[key]['wait'] = services[key]['wait'] + 's';
            }
        }
    } else {
        config['services'] = {};
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
