'use strict';

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const util = require('dockerode/lib/util');
const parseEnv = require('../../lib/parse-env');
const renderTemplate = require('../../lib/render-template');

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
async function exports (whaler) {

    whaler.on('config', async ctx => {
        const { default: storage } = await whaler.fetch('apps');
        const app = await storage.get(ctx.options['name']);

        const update = {};
        if (ctx.options['setEnv']) {
            app.env = update['env'] = ctx.options['setEnv'];
        }
        if (ctx.options['update']) {
            update['config'] = prepareOutput(
                await loadConfig(app, ctx.options)
            );
        }

        if (Object.keys(update).length > 0) {
            await storage.update(ctx.options['name'], update);
            ctx.result = update['config'] || app.config;

        } else {
            let config = app.config;
            if (ctx.options['file']) {
                config = prepareOutput(
                    await loadConfig(app, ctx.options)
                );
            }
            ctx.result = config;
        }
    });

    // TODO: experimental
    whaler.on('config:env', async ctx => {
        const { default: storage } = await whaler.fetch('apps');
        const app = await storage.get(ctx.options['name']);
        ctx.result = app.env;
    });

    // TODO: experimental
    whaler.on('config:prepare', async ctx => {
        ctx.result = await prepareConfig(
            ctx.options['config'],
            ctx.options['app'].env,
            opts => loadConfig(ctx.options['app'], opts)
        );
    });

    const loadConfig = async (app, options) => {
        let data;
        const vars = await prepareVars(app, options);
        const file = options['file'] || app.config['file'] || app.path + '/whaler.yml';

        // deprecated
        if (options['yml']) {
            const tmpFile = file + '.tmp';
            await fs.writeFile(tmpFile, options['yml'], 'utf8');
            data = await renderTemplate(tmpFile, vars);
            await fs.unlink(tmpFile);

        } else {
            if (!path.isAbsolute(file)) {
                throw new Error('Config path must be absolute.');
            }

            try {
                await fs.stat(file);
            } catch (e) {
                throw new Error('Config file "' + file + '" not exists.');
            }

            data = await renderTemplate(file, vars);
        }

        // data = data.replace('[app_name]', options['name']);
        // data = data.replace('[app_path]', app.path);
        data = yaml.load(data);

        return {
            file: file,
            //data: await prepareConfig(data, app.env, (opts) => loadConfig(app, opts))
            data: await whaler.emit('config:prepare', {
                app: app,
                config: data
            })
        };
    };

    const prepareVars = async (app, options) => {
        const vars = await whaler.emit('vars');

        try {
            const content = await fs.readFile(app.path + '/.env', 'utf8');
            const env = parseEnv(content || '');
            for (let key in env) {
                vars[key] = env[key];
            }
        } catch (e) {}

        try {
            const content = await fs.readFile(app.path + '/.env.local', 'utf8');
            const env = parseEnv(content || '');
            for (let key in env) {
                vars[key] = env[key];
            }
        } catch (e) {}

        vars['APP_NAME'] = options['name'];
        vars['APP_PATH'] = app.path;
        vars['APP_ENV'] = app.env;

        return vars;
    };

}

// PRIVATE

/**
 * @param arr
 * @returns {Object}
 */
function convertArrayToObject (arr, separator = ';') {
    const obj = {};
    if (arr) {
        for (let str of arr) {
            const [ key, ...rest ] = str.split(separator);
            const value = rest && rest.join(separator);
            if (value.length) {
                obj[key] = value;
            } else {
                obj[key] = null;
            }
        }
    }
    return obj;
}

/**
 * @param obj
 * @returns {Array}
 */
function convertObjectToArray (obj, separator = ';') {
    const arr = [];
    if (obj) {
        for (let key in obj) {
            if ('object' == typeof obj[key] || 'undefined' == typeof obj[key]) {
                arr.push(key);
            } else {
                arr.push(key + separator + obj[key]);
            }
        }
    }
    return arr;
}

/**
 * @param config
 * @returns {Object}
 */
function prepareOutput (config) {
    const tmp = [];

    const convert = (original, separator) => {
        let converted;
        const found = tmp.find(value => value.original === original);
        if (found) {
            converted = found.converted;
        } else {
            converted = convertObjectToArray(original, separator);
            tmp.push({ original, converted });
        }
        return converted;
    };

    for (let key in config['data']['services']) {
        const service = config['data']['services'][key];
        if (service['env'] && !Array.isArray(service['env'])) {
            service['env'] = convert(service['env'], '=');
        }
        if (service['volumes'] && !Array.isArray(service['volumes'])) {
            service['volumes'] = convert(service['volumes'], ':');
        }
    }

    config['data'] = yaml.load(yaml.dump(config['data'], { indent: 2 }));

    return config;
}

/**
 * @param config
 * @param env
 * @returns {Object}
 */
async function prepareConfig (config, env, loader) {
    config = config || {};
    config = prepareConfigEnv(config, env);
    if (config['services'] || null) {
        const scale = {};
        const services = config['services'];
        for (let key in services) {
            if (!/^[a-z0-9-]+$/.test(key)) {
                throw new Error('Service name "' + key + '" includes invalid characters, only "[a-z0-9-]" are allowed.');
            }

            if (services[key]['env'] && Array.isArray(services[key]['env'])) {
                services[key]['env'] = convertArrayToObject(services[key]['env'], '=');
            }

            if (services[key]['volumes'] && Array.isArray(services[key]['volumes'])) {
                services[key]['volumes'] = convertArrayToObject(services[key]['volumes'], ':');
            }

            if (services[key]['extends']) {
                const ex = await loader({
                    file: path.resolve(services[key]['extends']['file'])
                });
                const data = ex['data']['services'][services[key]['extends']['service']];
                const fn = services[key]['extends']['fn'];
                delete services[key]['extends'];

                // TODO: experimental
                if (fn) {
                    const service = fn({ service: data, local: services[key] });
                    if (service) {
                        services[key] = util.extend({}, services[key], service);
                    }
                }

                services[key] = util.extend({}, data, services[key]);
            }

            if (services[key]['extend']) {
                if ('string' === typeof services[key]['extend']) {
                    let service = services[key]['extend'];
                    let type = 'exclude';
                    let keys = [];

                    if (service.indexOf('&') !== -1) {
                        type = 'include';
                        const parts = service.split('&');
                        service = parts[0];
                        keys = parts[1].split(',');
                    } else if (service.indexOf('!') !== -1) {
                        type = 'exclude';
                        const parts = service.split('!');
                        service = parts[0];
                        keys = parts[1].split(',');
                    }

                    services[key]['extend'] = { service, type, keys };
                }

                // TODO: BC
                if (services[key]['extend']['include']) {
                    services[key]['extend']['type'] = 'include';
                    services[key]['extend']['keys'] = services[key]['extend']['include'];
                } else if (services[key]['extend']['exclude']) {
                    services[key]['extend']['type'] = 'exclude';
                    services[key]['extend']['keys'] = services[key]['extend']['exclude'];
                }

                let data = {};
                if (services[key]['extend']['keys']) {
                    if ('include' === services[key]['extend']['type']) {
                        for (let include of services[key]['extend']['keys']) {
                            if (services[services[key]['extend']['service']].hasOwnProperty(include)) {
                                data[include] = services[services[key]['extend']['service']][include];
                            }
                        }
                    } else {
                        data = util.extend({}, services[services[key]['extend']['service']]);
                        for (let exclude of services[key]['extend']['keys']) {
                            if (data.hasOwnProperty(exclude)) {
                                delete data[exclude];
                            }
                        }
                    }
                }
                const fn = services[key]['extend']['fn'];
                delete services[key]['extend'];

                if (data.hasOwnProperty('ports')) {
                    delete data['ports'];
                }

                // TODO: experimental
                if (fn) {
                    const service = fn({ service: data, local: services[key] });
                    if (service) {
                        services[key] = util.extend({}, services[key], service);
                    }
                }

                services[key] = util.extend({}, data, services[key]);
            }

            if ('object' === typeof services[key]['build'] && services[key]['build'].hasOwnProperty('args')) {
                if (!Array.isArray(services[key]['build']['args'])) {
                    const buildargs = [];
                    for (let arg in services[key]['build']['args']) {
                        if ('object' == typeof services[key]['build']['args'][arg]) {
                            buildargs.push(arg);
                        } else {
                            buildargs.push(arg + '=' + services[key]['build']['args'][arg]);
                        }
                    }
                    services[key]['build']['args'] = buildargs;
                }
            }

            if (services[key]['wait'] && 'string' !== typeof services[key]['wait']) {
                services[key]['wait'] = services[key]['wait'] + 's';
            }

            // TODO: experimental
            if (services[key].hasOwnProperty('scale')) {
                if (services[key]['scale']) {
                    scale[key] = services[key]['scale'];
                }
                delete services[key]['scale'];
            }
        }

        // TODO: experimental
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
function prepareConfigEnv (config, env) {
    if ('object' === typeof config && null !== config && Object.keys(config).length) {
        env = env.split(',');
        const keys = Object.keys(config);
        for (let key of keys) {
            if ('~' == key[0]) {
                const parts = key.split('~')[1].split(',');
                for (let e of env) {
                    if (parts.includes(e)) {
                        const tmpConfig = {};
                        for (let index in config) {
                            if (index == key) {
                                util.extend(tmpConfig, config[key]);
                            } else if (!tmpConfig.hasOwnProperty(index)) {
                                tmpConfig[index] = config[index];
                            }
                        }
                        config = tmpConfig;
                        //config = util.extend({}, config, config[key]);
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
