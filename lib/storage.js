'use strict';

var util = require('util');
var extend = require('dockerode/lib/util').extend;
var Datastore = require('nedb');

module.exports = Storage;

/**
 * @param filename
 * @param callback
 */
function loadDb(filename, callback) {
    const db = new Datastore({
        filename: filename
    });
    db.loadDatabase((err) => {
        if (err) {
            throw err;
        }
        callback(db);
    });
}

/**
 * @param name
 * @constructor
 */
function Storage(name) {
    if (name) {
        const filename = '/var/lib/whaler/storage/' + name;
        this.db = {
            find: (...args) => {
                loadDb(filename, (db) => {
                    db.find(...args);
                });
            },
            insert: (...args) => {
                loadDb(filename, (db) => {
                    db.insert(...args);
                });
            },
            update: (...args) => {
                loadDb(filename, (db) => {
                    db.update(...args);
                });
            },
            remove: (...args) => {
                loadDb(filename, (db) => {
                    db.remove(...args);
                });
            },
        };

    }  else {
        this.db = new Datastore();
    }
}

/**
 * @type {Object}
 */
Storage.prototype.errors = {};

/**
 * @param callback
 */
Storage.prototype.all = function(callback) {
    this.db.find({}, (err, docs) => {
        if (err) {
            return callback(err);
        }

        const data = {};
        for (let doc of docs) {
            const id = doc['_id'];
            delete doc['_id'];
            data[id] = doc;
        }

        return callback(null, data);
    });
};

/**
 * @param id
 * @param callback
 */
Storage.prototype.get = function(id, callback) {
    let errMsg = '"%s" not found.';
    if (this.errors[errMsg]) {
        errMsg = this.errors[errMsg];
    }

    this.db.find({ _id: id }, (err, docs) => {
        if (err) {
            return callback(err);
        }

        const data = docs[0] || null;
        if (!data || id !== data['_id']) {
            return callback(
                new Error(
                    util.format(errMsg, id)
                )
            );
        }
        delete data['_id'];

        return callback(null, data);
    });
};

/**
 * @param id
 * @param data
 * @param callback
 */
Storage.prototype.insert = function(id, data, callback) {
    callback = callback || function() {};

    let errMsg = '"%s" already exists.';
    if (this.errors[errMsg]) {
        errMsg = this.errors[errMsg];
    }

    this.db.insert(extend({ _id: id }, data), (err, doc) => {
        if (err) {
            return callback(
                new Error(
                    util.format(errMsg, id)
                )
            );
        }
        delete doc['_id'];
        callback(null, doc);
    });
};

/**
 * @param id
 * @param data
 * @param callback
 */
Storage.prototype.update = function(id, data, callback) {
    callback = callback || function() {};

    this.db.update({ _id: id }, { $set: data }, {}, (err, numReplaced) => {
        if (err) {
            return callback(err);
        }
        callback(null);
    });
};

/**
 * @param id
 * @param callback
 */
Storage.prototype.remove = function(id, callback) {
    callback = callback || function() {};

    this.db.remove({ _id: id }, {}, (err, numRemoved) => {
        if (err) {
            return callback(err);
        }
        callback(null);
    });
};
