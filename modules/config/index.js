'use strict';

var fs = require('fs');
var YAML = require('yamljs');
var util = require('dockerode/lib/util');

var addCmd = function(whaler) {
    var pkg = require('./package.json');
    var console = whaler.require('./lib/console');

    whaler.cli.command(
        pkg.name + ' [name]'
    ).description(
        pkg.description
    ).option(
        '--update',
        'Update config'
    ).option(
        '--config <CONFIG>',
        'Config to use'
    ).option(
        '--set-env <ENV>',
        'Set application environment'
    ).action(function(name, options) {

        var opts = {
            name: name,
            update: options.update,
            config: options.config,
            setEnv: options.setEnv
        };

        whaler.events.emit('config', opts, function(err, config) {
            console.log('');
            if (err) {
                return console.error('[%s] %s', process.pid, err.message, '\n');
            }

            var name = whaler.helpers.getName(opts.name);
            if (opts.update) {
                console.info('[%s] Application "%s" config updated.', process.pid, name, '\n');
            } else if (opts.setEnv) {
                console.info('[%s] Application "%s" env updated.', process.pid, name, '\n');
            } else {
                console.info(config.file, '\n');

                var data = YAML.stringify(config.data, 4);
                data = data.replace(/dockerfile: "(.*)\\n"/g, 'dockerfile: |\n        $1');
                data = data.replace(/(\\n)/g, '\n        ');
                console.log(data);
            }
        });

    }).on('--help', function() {
        whaler.cli.argumentsHelp(this, {
            'name': 'Application name'
        });
    });
};

var prepareConfigEnv = function(config, env) {
    if ('object' === typeof config && Object.keys(config).length) {
        var keys = Object.keys(config);
        keys.forEach(function(key) {
            if ('~' == key[0]) {
                if ('~' + env == key) {
                    config = util.extend({}, config, config[key]);
                }
                delete config[key];
                config = prepareConfigEnv(config, env);
            } else {
                config[key] = prepareConfigEnv(config[key], env);
            }
        });
    }

    return config;
};

var prepareConfig = function(config, env) {
    config = prepareConfigEnv(config, env);
    for (var key in config) {
        if (config[key]['extend']) {
            config[key] = util.extend({}, config[config[key]['extend']], config[key]);
            delete config[key]['extend'];
        }

        if (config[key]['volumes'] && !Array.isArray(config[key]['volumes'])) {
            var volumes = [];
            for (var v in config[key]['volumes']) {
                volumes.push(v + ':' + config[key]['volumes'][v]);
            }
            config[key]['volumes'] = volumes;
        }

        if (config[key]['env'] && !Array.isArray(config[key]['env'])) {
            var env = [];
            for (var e in config[key]['env']) {
                env.push(e + '=' + config[key]['env'][e]);
            }
            config[key]['env'] = env;
        }

        if (config[key]['wait'] && 'string' !== typeof config[key]['wait']) {
            config[key]['wait'] = config[key]['wait'] + 's';
        }
    }

    return config;
};

module.exports = function(whaler) {

    addCmd(whaler);

    whaler.events.on('config', function(options, callback) {
        options['name'] = whaler.helpers.getName(options['name']);

        whaler.apps.get(options['name'], function(err, app) {
            if (err) {
                return callback(err);
            }

            var update = {};

            var loadConfig = function() {
                var file = whaler.helpers.getPath(
                    options['config'] || app.config['file'] || app.path + '/whaler.yml'
                );
                try {
                    var data = fs.readFileSync(file, 'utf8');
                    data = data.replace('[app_path]', app.path);
                    data = YAML.parse(data);

                } catch (e) {
                    return callback(e);
                }

                return {
                    file: file,
                    data: prepareConfig(data, app.env)
                };
            };

            if (options['setEnv']) {
                app.env = update['env'] = options['setEnv'];
            }

            if (options['update']) {
                update['config'] = loadConfig();
            }

            if (Object.keys(update).length > 0) {
                whaler.apps.update(options['name'], update, function(err) {
                    if (err) {
                        return callback(err);
                    }
                    callback(null, update['config'] || app.config);
                });

            } else {
                var config = app.config;
                if (options['config']) {
                    config = loadConfig();
                }

                callback(null, config);
            }
        });
    });
};
