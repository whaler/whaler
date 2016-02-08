'use strict';

var Storage = require('../lib/storage');

module.exports = new Vars();

function Vars() {
    this._storage = new Storage('/var/lib/whaler/storage/vars');

    this.errors = {
        '"%s" not found.': 'An var with "%s" name not found.'
    };
}

/**
 * @param callback
 */
Vars.prototype.all = function(callback) {
    this._storage.all((err, data) => {
        if (err) {
            return callback(err);
        }
        const vars = {};
        for (let key in data) {
            vars[key] = data[key]['value'];
        }
        callback(null, vars);
    });
};

/**
 * @param name
 * @param callback
 */
Vars.prototype.get = function(name, callback) {
    this._storage.get(name, (err, data) => {
        if (err) {
            return callback(err);
        }
        callback(null, data['value'] || '');
    });
};

/**
 * @param name
 * @param value
 * @param callback
 */
Vars.prototype.set = function(name, value, callback) {
    const data = {
        value: value || ''
    };
    this._storage.insert(name, data, (err) => {
        if (err) {
            return this.get(name, (_err, value) => {
                if (_err) {
                    return callback(err);
                }
                this._storage.update(name, data, (err) => {
                    if (err) {
                        return callback(err);
                    }
                    callback(null);
                });
            });
        }
        callback(null);
    });
};

/**
 * @param name
 * @param callback
 */
Vars.prototype.unset = function(name, callback) {
    this._storage.remove(name, callback);
};
