'use strict';

require('x-node').inject();

var fs = require('fs');
var util = require('util');
var EventEmitter = require('x-node/events');
var parseEnv = require('./lib/parse-env');

module.exports = Whaler;

function Whaler() {
    this.path = __dirname;
}

util.inherits(Whaler, EventEmitter);

/**
 * @prototype
 * @param gen
 * @param callback
 */
Whaler.prototype.$async = function(gen, callback) {
    gen.$async(callback)();
};

/**
 * @api
 * @param id
 */
Whaler.prototype.require = function(id) {
    return module.require(id);
};

/**
 * @api
 * @param id
 */
Whaler.prototype.get = function(id) {
    return module.require('./src/' + id);
};

/**
 * Base method
 */
Whaler.prototype.init = function() {
    // base
    mkdir('/etc/whaler');
    loadEnv('/etc/whaler/env');

    // home
    if (fs.existsSync(process.env.HOME + '/.whaler')) {
        loadEnv(process.env.HOME + '/.whaler/env');
    }

    // bridge
    mkdir('/var/lib/whaler/bin');
    fs.writeFileSync('/var/lib/whaler/bin/bridge', fs.readFileSync(__dirname + '/bin/bridge'), { mode: '755' });

    // SIGINT
    this.on('SIGINT', () => {
        process.stdout.write('\n');
        process.exit();
    });
    process.on('SIGINT', () => {
        this.emit('SIGINT');
    });
    //process.stdin.on('data', (key) => {
    //    // Ctrl+C
    //    if (key === '\u0003') {
    //        this.emit('SIGINT');
    //    }
    //});
    process.stdin.setEncoding('utf8');
    process.stdin.pause();
};

// PRIVATE

function mkdir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
}

function loadEnv(envFile) {
    if (fs.existsSync(envFile)) {
        let content;
        try {
            content = fs.readFileSync(envFile, 'utf8');
        } catch (e) {
            throw new TypeError('Environment file could not be read: ' + e);
        }

        const env = parseEnv(content || '');
        for (let key in env) {
            if ('undefined' === typeof process.env[key]) {
                process.env[key] = env[key];
            }
        }
    } else {
        fs.writeFileSync(envFile, fs.readFileSync(__dirname + '/.env'));
    }
}
