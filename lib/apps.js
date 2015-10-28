'use strict';

var Datastore = require('nedb');

/**
 * @constructor
 */
var Apps = function() {
    this.db = new Datastore({
        filename: '/etc/whaler/apps.db',
        autoload: true
    });
};

/**
 * @param callback
 */
Apps.prototype.all = function(callback) {
    this.db.find({}, function(err, docs) {
        if (err) {
            return callback(err);
        }

        var apps = {};
        docs.forEach(function(doc) {
            var appName = doc['_id'];
            delete doc['_id'];
            apps[appName] = doc;
        });

        return callback(null, apps);
    });
};

/**
 * @param appName
 * @param callback
 */
Apps.prototype.get = function(appName, callback) {
    this.db.find({ _id: appName }, function(err, docs) {
        if (err) {
            return callback(err);
        }

        var app = docs[0] || null;
        if (!app || appName !== app['_id']) {
            return callback(
                new Error('An application with "' + appName + '" name not found.')
            );
        }
        delete app['_id'];

        return callback(null, app);
    });
};

/**
 * @param appName
 * @param data
 * @param callback
 */
Apps.prototype.add = function(appName, data, callback) {
    callback = callback || function() {};

    var app = data;
    app['_id'] = appName;

    this.db.insert(app, function(err, doc) {
        if (err) {
            return callback(
                new Error('An application with "' + app['_id'] + '" name already exists.')
            );
        }
        delete doc['_id'];
        callback(null, doc);
    });
};

/**
 * @param appName
 * @param data
 * @param callback
 */
Apps.prototype.update = function(appName, data, callback) {
    callback = callback || function() {};

    this.db.update({ _id: appName }, { $set: data }, {}, function(err, numReplaced) {
        if (err) {
            return callback(err);
        }
        callback(null);
    });
};

/**
 * @param appName
 * @param callback
 */
Apps.prototype.remove = function(appName, callback) {
    callback = callback || function() {};

    this.db.remove({ _id: appName }, {}, function(err, numRemoved) {
        if (err) {
            return callback(err);
        }
        callback(null);
    });
};

module.exports = Apps;
