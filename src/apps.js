'use strict';

var yaml = require('js-yaml');
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
    this._storage.all(function(err, data) {
        for (let name in data) {
            data[name] = prepareDataToGet(data[name]);
        }
        callback(err, data);
    });
};

/**
 * @param name
 * @param callback
 */
Apps.prototype.get = function(name, callback) {
    this._storage.get(name, function(err, data) {
        callback(err, prepareDataToGet(data));
    });
};

/**
 * @param name
 * @param data
 * @param callback
 */
Apps.prototype.add = function(name, data, callback) {
    this._storage.insert(name, prepareDataToSet(data), function(err, data) {
        callback(err, prepareDataToGet(data));
    });
};

/**
 * @param name
 * @param data
 * @param callback
 */
Apps.prototype.update = function(name, data, callback) {
    this._storage.update(name, prepareDataToSet(data), function(err) {
        prepareDataToGet(data);
        callback(err);
    });
};

/**
 * @param name
 * @param callback
 */
Apps.prototype.remove = function(name, callback) {
    this._storage.remove(name, callback);
};

// PRIVATE

/**
 * @param data
 * @returns {*}
 */
function prepareDataToSet(data) {
    if (data && data['config'] && data['config']['data'] && 'string' !== typeof data['config']['data']) {
        data['config']['data'] = yaml.dump(data['config']['data'], { indent: 2 });
    }

    return data;
}

/**
 * @param data
 * @returns {*}
 */
function prepareDataToGet(data) {
    if (data && data['config'] && data['config']['data'] && 'string' === typeof data['config']['data']) {
        data['config']['data'] = yaml.load(data['config']['data']);
    }

    return data;
}
