'use strict';

var yaml = require('js-yaml');
var Storage = require('../lib/storage');

module.exports = new Apps('apps');
module.exports.Apps = Apps;

function Apps(name) {
    this._storage = new Storage(name);
    this._storage.errors = {
        '"%s" not found.': 'An application with "%s" name not found.',
        '"%s" already exists.': 'An application with "%s" name already exists.'
    };
}

/**
 * @param callback
 */
Apps.prototype.all = function(callback) {
    this._storage.all((err, data) => {
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
    this._storage.get(name, (err, data) => {
        callback(err, prepareDataToGet(data));
    });
};

/**
 * @param name
 * @param data
 * @param callback
 */
Apps.prototype.add = function(name, data, callback) {
    this._storage.insert(name, prepareDataToSet(data), (err, data) => {
        callback(err, prepareDataToGet(data));
    });
};

/**
 * @param name
 * @param data
 * @param callback
 */
Apps.prototype.update = function(name, data, callback) {
    this._storage.update(name, prepareDataToSet(data), (err) => {
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
    if (data && data['config']) {
        if (data['config']['data']) {
            if ('string' !== typeof data['config']['data']) {
                data['config']['data'] = yaml.dump(data['config']['data'], { indent: 2 });
            }
        } else {
            data['config']['data'] = '';
        }
    }

    return data;
}

/**
 * @param data
 * @returns {*}
 */
function prepareDataToGet(data) {
    if (data && data['config']) {
        if (data['config']['data']) {
            if ('string' === typeof data['config']['data']) {
                data['config']['data'] = yaml.load(data['config']['data']);
            }
        } else {
            data['config']['data'] = {
                services: {}
            };
        }
    }

    return data;
}
