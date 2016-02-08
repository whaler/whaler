'use strict';

var Storage = require('../lib/storage');

module.exports = new Apps();

function Apps() {
    this._storage = new Storage('/var/lib/whaler/storage/apps');

    this.errors = {
        '"%s" not found.': 'An application with "%s" name not found.',
        '"%s" already exists.': 'An application with "%s" name already exists.'
    };
}

/**
 * @param callback
 */
Apps.prototype.all = function(callback) {
    this._storage.all(callback);
};

/**
 * @param name
 * @param callback
 */
Apps.prototype.get = function(name, callback) {
    this._storage.get(name, callback);
};

/**
 * @param name
 * @param data
 * @param callback
 */
Apps.prototype.add = function(name, data, callback) {
    this._storage.insert(name, data, callback);
};

/**
 * @param name
 * @param data
 * @param callback
 */
Apps.prototype.update = function(name, data, callback) {
    this._storage.update(name, data, callback);
};

/**
 * @param name
 * @param callback
 */
Apps.prototype.remove = function(name, callback) {
    this._storage.remove(name, callback);
};
