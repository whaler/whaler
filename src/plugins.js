'use strict';

const Manager = require('nmpm');
const fetch = require('node-fetch');

class Plugins extends Manager {
    /**
     * @api public
     */
    constructor() {
        const path = process.env.WHALER_PLUGINS_PATH || '/var/lib/whaler/plugins';
        super('whaler-plugin', {
            opts: {
                'fund': false,
                'audit': false,
                'loglevel': 'error',
                'global-style': true,
                'package-lock': false,
                'prefix': path
            }
        });
        this.path = path;
    }

    /**
     * @api public
     * @param name
     */
    async info(name) {
        // https://github.com/<account>/<repository>[#version]
        if (-1 !== name.indexOf('https://github.com/')) {
            const parts = name.replace('github.com', 'raw.githubusercontent.com').split('#');
            const url = parts[0].replace(/\/+$/, '').replace(/\.git+$/, '');

            try {
                const res = await fetch(url + '/' + (parts.length > 1 ? parts[1] : 'master') + '/package.json');
                return await res.json();
            } catch (e) {}

            return false;
        }

        return await super.info(name);
    }
}

module.exports = new Plugins();
