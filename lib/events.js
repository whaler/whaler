'use strict';

var Q = require('q');

var makeNodeResolver = function(deferred) {
    return function(error) {
        if (error) {
            deferred.reject(error);
        } else {
            var args = Array.prototype.slice.call(arguments).slice(1);
            deferred.resolve(args);
        }
    };
};

var denodeify = function(callback) {
    var baseArgs = Array.prototype.slice.call(arguments).slice(1);
    return function() {
        var nodeArgs = baseArgs.concat(Array.prototype.slice.call(arguments).slice(0));
        var deferred = Q.defer();
        nodeArgs.push(makeNodeResolver(deferred));
        Q(callback).fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
};

/**
 * @param emitter
 * @param type
 * @param event
 * @param listener
 */
var addTypeListener = function(emitter, type, event, listener) {
    if (!emitter.listeners[type][event]) {
        emitter.listeners[type][event] = [];
    }
    if ('on' == type && emitter.listeners[type][event].length) {
        throw Error('Listener for event "' + event + '" already defined.');
    }
    emitter.listeners[type][event].push(denodeify(listener));
};

/**
 * @constructor
 */
var EventEmitter = function() {
    this.listeners = {
        on: {},
        after: {},
        before: {}
    };
};

/**
 * @param event
 * @param listener
 */
EventEmitter.prototype.on = function(event, listener) {
    addTypeListener(this, 'on', event, listener);
};

/**
 * @param event
 * @param listener
 */
EventEmitter.prototype.after = function(event, listener) {
    addTypeListener(this, 'after', event, listener);
};

/**
 * @param event
 * @param listener
 */
EventEmitter.prototype.before = function(event, listener) {
    addTypeListener(this, 'before', event, listener);
};

/**
 * @param event
 */
EventEmitter.prototype.emit = function(event) {
    var me = this;
    var response = [];
    var args = Array.prototype.slice.call(arguments).slice(1);
    var callback = 'function' === typeof args[args.length -1] ? args.pop() : null;

    var promise = Q.async(function*() {
        if (me.listeners['on'][event]) {

            if (me.listeners['before'][event]) {
                var listeners = me.listeners['before'][event].slice(0);
                while (listeners.length) {
                    var listener = listeners.shift();
                    var data = yield listener.apply(null, args);
                }
            }

            var listeners = me.listeners['on'][event].slice(0);
            while (listeners.length) {
                var listener = listeners.shift();
                response = yield listener.apply(null, args);
            }

            if (me.listeners['after'][event]) {
                var listeners = me.listeners['after'][event].slice(0);
                while (listeners.length) {
                    var listener = listeners.shift();
                    var data = yield listener.apply(null, args);
                }
            }

            return response;

        } else {
            throw Error('Event "' + event + '" not defined.');
        }
    })();

    promise.done(function(response) {
        if (callback) {
            response.unshift(null);
            callback.apply(null, response);
        }

    }, function(err) {
        if (callback) {
            return callback(err);
        }
        console.error('[%s] %s', process.pid, err.message, '\n');
    });
};

module.exports = EventEmitter;
