'use strict';

var Manager = require('nmpm');
var request = require('request');

/**
 * @param name
 * @param callback
 */
Manager.prototype.__info = Manager.prototype.info;
Manager.prototype.info = function(name, callback) {
    var me = this;

    // https://github.com/<account>/<repository>[#version]
    if (-1 !== name.indexOf('https://github.com/')) {

        const parts = name.replace('github.com', 'raw.githubusercontent.com').split('#');
        const url = parts[0].replace(/\/+$/, '').replace(/\.git+$/, '');

        request(url + '/' + (parts.length > 1 ? parts[1] : 'master') + '/package.json', function (err, resp, body) {
            if (err) {
                return callback(err);
            }

            if (resp.statusCode == 200) {
                return callback(null, JSON.parse(body));
            }

            return callback(null, false);
        });

        return;
    }

    me.__info(name, callback);
};

module.exports = new Manager('whaler-plugin', {
    prefix: '/var/lib/whaler/plugins'
});
