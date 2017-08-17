'use strict';

var fs = require('fs');
var path = require('path');
var yaml = require('js-yaml');
var util = require('dockerode/lib/util');
var parseEnv = require('../../lib/parse-env');
var renderTemplate = require('../../lib/render-template');

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
            update['config'] = yield loadConfig.$call(whaler, app, options);
        }

        if (Object.keys(update).length > 0) {
            yield storage.update.$call(storage, options['name'], update);
            return update['config'] || app.config;

        } else {
            let config = app.config;
            if (options['file']) {
                config = yield loadConfig.$call(whaler, app, options);
            }

            return config;
        }
    });

}

// PRIVATE

/**
 * @param app
 * @param options
 */
function* loadConfig(app, options) {
    let data;
    const whaler = this;
    const vars = yield prepareVars.$call(whaler, app, options);
    const file = options['file'] || app.config['file'] || app.path + '/whaler.yml';

    // deprecated
    if (options['yml']) {
        const tmpFile = file + '.tmp';
        yield fs.writeFile.$call(null, tmpFile, options['yml'], 'utf8');
        data = yield renderTemplate.$call(null, tmpFile, vars);
        yield fs.unlink.$call(null, tmpFile);

    } else {
        if (!path.isAbsolute(file)) {
            throw new Error('Config path must be absolute.');
        }

        try {
            yield fs.stat.$call(null, file);
        } catch (e) {
            throw new Error('Config file "' + file + '" not exists.');
        }

        data = yield renderTemplate.$call(null, file, vars);
    }

    // data = data.replace('[app_name]', options['name']);
    // data = data.replace('[app_path]', app.path);
    data = yaml.load(data);

    return {
        file: file,
        data: prepareConfig(data, app.env),
    };
}

/**
 * @param app
 * @param options
 */
function* prepareVars(app, options) {
    const whaler = this;
    const vars = yield whaler.$emit('vars');

    try {
        let content = yield fs.readFile.$call(null, app.path + '/.env', 'utf8');
        const env = parseEnv(content || '');
        for (let key in env) {
            vars[key] = env[key];
        }
    } catch (e) {}

    vars['APP_NAME'] = options['name'];
    vars['APP_PATH'] = app.path;

    return vars;
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
        const scale = {};
        const services = config['services'];
        for (let key in services) {
            if (!/^[a-z0-9-]+$/.test(key)) {
                throw new Error('Service name "' + key + '" includes invalid characters, only "[a-z0-9-]" are allowed.');
            }

            if (services[key]['extend']) {
                if ('string' === typeof services[key]['extend']) {
                    let service = services[key]['extend'];
                    let include = undefined;
                    let exclude = undefined;
                    if (service.indexOf('&') !== -1) {
                        const parts = service.split('&');
                        service = parts[0];
                        include = parts[1].split(',');
                    } else if (service.indexOf('!') !== -1) {
                        const parts = service.split('!');
                        service = parts[0];
                        exclude = parts[1].split(',');
                    }

                    services[key]['extend'] = {
                        service: service,
                        include: include,
                        exclude: exclude
                    };
                }

                let data = {};
                if (services[key]['extend']['include']) {
                    for (let include of services[key]['extend']['include']) {
                        if (services[services[key]['extend']['service']].hasOwnProperty(include)) {
                            data[include] = services[services[key]['extend']['service']][include];
                        }
                    }
                } else {
                    data = util.extend({}, services[services[key]['extend']['service']]);
                    if (services[key]['extend']['exclude']) {
                        for (let exclude of services[key]['extend']['exclude']) {
                            if (data.hasOwnProperty(exclude)) {
                                delete data[exclude];
                            }
                        }
                    }
                }

                if (data.hasOwnProperty('ports')) {
                    delete data['ports'];
                }

                services[key] = util.extend({}, data, services[key]);

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

            // experimental
            if (services[key].hasOwnProperty('scale')) {
                if (services[key]['scale']) {
                    scale[key] = services[key]['scale'];
                }
                delete services[key]['scale'];
            }
        }

        // experimental
        if (Object.keys(scale).length) {
            const newServices = {};
            for (let key in services) {
                if (scale[key] || false) {
                    for (let i = 1; i <= scale[key]; i++) {
                        newServices[key + i] = services[key];
                    }
                } else {
                    newServices[key] = services[key];
                }
            }
            config['services'] = newServices;
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
        env = env.split(',');
        const keys = Object.keys(config);
        for (let key of keys) {
            if ('~' == key[0]) {
                const parts = key.split('~')[1].split(',');
                for (let e of env) {
                    if (parts.includes(e)) {
                        config = util.extend({}, config, config[key]);
                    }
                }
                delete config[key];
                config = prepareConfigEnv(config, env.join(','));
            } else {
                config[key] = prepareConfigEnv(config[key], env.join(','));
            }
        }
    }

    return config;
}
