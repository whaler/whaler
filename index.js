'use strict';

require('x-node').inject();

var fs = require('fs');
var util = require('util');
var EventEmitter = require('x-node/events');

module.exports = Whaler;

function Whaler() {
    this.path = __dirname;
}

util.inherits(Whaler, EventEmitter);

/**
 * @param id
 */
Whaler.prototype.require = function(id) {
    return module.require(id);
};

/**
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
    fs.writeFileSync('/var/lib/whaler/bin/bridge', fs.readFileSync(__dirname + '/bin/bridge'));
    fs.chmodSync('/var/lib/whaler/bin/bridge', '4755');

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
        let lines;
        try {
            lines = (fs.readFileSync(envFile, 'utf8') || '')
                .split(/\r?\n|\r/)
                .filter((line) => {
                    return /\s*=\s*/i.test(line);
                })
                .map((line) => {
                    return line.replace('export ', '');
                });

        } catch (e) {
            throw new TypeError('Environment file could not be read: ' + e);
        }

        lines.forEach((line) => {
            if (/^\s*\#/i.test(line)) {
                // ignore comment lines (starting with #)

            } else {
                const env = line.match(/^([^=]+)\s*=\s*(.*)$/);
                const key = env[1];
                // remove ' and " characters if right side of = is quoted
                const value = env[2].match(/^(['"]?)([^\n]*)\1$/m)[2];

                if ('undefined' === typeof process.env[key]) {
                    process.env[key] = value;
                }
            }
        });
    } else {
        fs.writeFileSync(envFile, fs.readFileSync(__dirname + '/.env'));
    }
}
