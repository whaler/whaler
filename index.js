'use strict';

require('./lib/console');
require('./lib/polyfill');

const fs = require('fs').promises;
const parseEnv = require('./lib/parse-env');
const promisify = require('./lib/promisify');
const Application = require('./lib/application');

const CONFIG = Symbol('config');

// TODO: remove in v1
const promisifyCache = {};

class Whaler extends Application {
    /**
     * @api public
     */
    constructor() {
        super();
        this.path = __dirname;

        // TODO: remove in v1
        this._require = (id) => module.require(id);
    }

    /**
     * @api public
     */
    async kill(signal = 'SIGINT') {
        try {
            //process.exitCode = 0;
            await this.emit('kill', { signal });
        } catch (e) {}
    }

    /**
     * @api public
     */
    async init() {
        // base
        await mkdir('/etc/whaler');
        await loadEnv('/etc/whaler/env');

        // home
        if (await exists(process.env.HOME + '/.whaler')) {
            await loadEnv(process.env.HOME + '/.whaler/env');
        }

        // bridge
        await mkdir('/var/lib/whaler/bin');
        await fs.writeFile('/var/lib/whaler/bin/bridge', await fs.readFile(__dirname + '/bin/bridge'), { mode: '755' });

        // kill handler
        this.on('kill', async ctx => {
            await this.emit(ctx.options['signal']);
            process.stdout.write('\n');
            process.exit();
        });

        process.on('SIGINT', () => { this.kill('SIGINT'); });
        process.on('SIGHUP', () => { this.kill('SIGHUP'); });

        process.stdin.setEncoding('utf8');
        process.stdin.pause();
    }

    /**
     * @api
     */
    async config() {
        const configFile = '/etc/whaler/config.json';

        if (!this[CONFIG]) {
            let data = '{}';
            try {
                data = await fs.readFile(configFile, 'utf8');
            } catch (err) {}

            try {
                this[CONFIG] = JSON.parse(data);
            } catch (e) {
                throw new Error('Unexpected JSON format in ' + configFile);
            }
        }

        return this[CONFIG];
    }

    /**
     * @api
     * @param id
     */
    async import(id) {
        if (module.import) {
            return await module.import(id);
        }
        return { default: module.require(id) };
    }

    /**
     * @api
     * @param id
     */
    async fetch(id) {
        // TODO: refactor and remove in v1
        if (['apps', 'vars'].includes(id)) {
            if (!promisifyCache[id]) {
                const imported = await this.import('./src/' + id);
                promisifyCache[id] = { default: promisify(imported.default) };
            }
            return promisifyCache[id];
        }

        return await this.import('./src/' + id);
    }

    /**
     * @api
     */
    log(message, ...args) {
        return this.emit('console', { type: 'log', message, args });
    }

    /**
     * @api
     */
    info(message, ...args) {
        return this.emit('console', { type: 'info', message, args });
    }

    /**
     * @api
     */
    warn(message, ...args) {
        return this.emit('console', { type: 'warn', message, args });
    }

    /**
     * @api
     */
    error(message, ...args) {
        return this.emit('console', { type: 'error', message, args });
    }
}

module.exports = Whaler;

// PRIVATE

async function exists (path) {
    //return await fs.exists(path);
    try {
        await fs.stat(path);
        return true;
    } catch (e) {}

    return false;
}

async function mkdir (dir) {
    if (!(await exists(dir))) {
        await fs.mkdir(dir);
    }
}

async function loadEnv (envFile) {
    if (await exists(envFile)) {
        let content;
        try {
            content = await fs.readFile(envFile, 'utf8');
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
        await fs.writeFile(envFile, await fs.readFile(__dirname + '/.env'));
    }
}
