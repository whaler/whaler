'use strict';

var Manager = require('nmpm');

module.exports = new Manager('whaler-plugin', {
    prefix: '/var/lib/whaler/plugins'
});
