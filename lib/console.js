'use strict';

var util = require('util');
var colors  = require('colors');
colors.enabled = true;

var _ = function(args, type, color) {
    if (!type) {
        type = 'log';
    }
    if (color) {
        args = Array.prototype.slice.call(args);
        args.unshift(colors[color](args.shift()));
    }
    var log = util.format.apply(this, args);
    console[type].apply(console, [log]);
};

module.exports = {
    $: console,
    _: _,

    log: function() {
        _(arguments, 'log');
    },

    info: function() {
        _(arguments, 'info', 'blue');
    },

    warn: function() {
        _(arguments, 'warn', 'yellow');
    },

    error: function() {
        _(arguments, 'error', 'red');
    }
};
