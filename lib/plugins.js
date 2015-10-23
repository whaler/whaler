'use strict';

var path = require('path');
var Manager = require('nmpm');

var plugins = new Manager('whaler-plugin', {
    global: true
});

module.exports = plugins;
