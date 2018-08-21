'use strict';

const util = require('util');
const Manager = require('nmpm');
const request = require('request');

const asyncRequest = util.promisify((url, callback) => {
    request(url, (err, resp, body) => {
        if (err) {
            return callback(err);
        }

        callback(null, { resp, body });
    });
});

class Plugins extends Manager {
    /**
     * @api public
     */
    constructor() {
        super('whaler-plugin', {
            opts: {
                'audit': false,
                'loglevel': 'error',
                'package-lock': false,
                'prefix': '/var/lib/whaler/plugins'
            }
        });
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

            const { resp, body } = await asyncRequest(url + '/' + (parts.length > 1 ? parts[1] : 'master') + '/package.json');
            if (resp.statusCode == 200) {
                return JSON.parse(body);
            }

            return false;
        }

        return await super.info(name);
    }
}

module.exports = new Plugins();
