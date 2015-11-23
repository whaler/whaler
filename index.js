'use strict';

var fs = require('fs');
var Apps = require('./lib/apps');
var EventEmitter = require('./lib/events');

var mkdir = function(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
};

var loadEnv = function(envFile) {
    if (fs.existsSync(envFile)) {
        var lines;
        try {
            lines = (fs.readFileSync(envFile, 'utf8') || '')
            .split(/\r?\n|\r/)
            .filter(function(line) {
                return /\s*=\s*/i.test(line);
            })
            .map(function(line) {
                return line.replace('export ', '');
            });

        } catch (e) {
            throw new TypeError('Environment file could not be read: ' + e);
        }

        lines.forEach(function(line) {
            if (/^\s*\#/i.test(line)) {
                // ignore comment lines (starting with #)

            } else {
                var env = line.match(/^([^=]+)\s*=\s*(.*)$/);
                var key = env[1];
                // remove ' and " characters if right side of = is quoted
                var value = env[2].match(/^(['"]?)([^\n]*)\1$/m)[2];

                if ('undefined' === typeof process.env[key]) {
                    process.env[key] = value;
                }
            }
        })
    } else {
        fs.writeFileSync(envFile, fs.readFileSync(__dirname + '/.env'));
    }
};

var Whaler = function() {

    if (fs.existsSync(process.env.HOME + '/.whaler')) {
        loadEnv(process.env.HOME + '/.whaler/env');
    }

    mkdir('/etc/whaler');

    loadEnv('/etc/whaler/env');

    this.path    = __dirname;

    this.cli     = require('./lib/cli');
    this.docker  = require('./lib/docker');
    this.helpers = require('./lib/helpers');
    this.modules = require('./lib/modules');
    this.plugins = require('./lib/plugins');

    this.apps    = new Apps();
    this.events  = new EventEmitter();

    this.require = function(id) {
        return module.require(id);
    };

    mkdir('/etc/whaler/bin');
    fs.writeFileSync('/etc/whaler/bin/me', fs.readFileSync(__dirname + '/bin/me'));
    fs.chmodSync('/etc/whaler/bin/me', '4755');
};

module.exports = Whaler;
