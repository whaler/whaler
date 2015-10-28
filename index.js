'use strict';

var fs = require('fs');
var Apps = require('./lib/apps');
var EventEmitter = require('./lib/events');

var mkdir = function(dir) {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
};

var Whaler = function() {

    mkdir('/etc/whaler');

    this.path    = __dirname;

    this.cli     = require('./lib/cli');
    this.docker  = require('./lib/docker');
    this.helpers = require('./lib/helpers');
    this.modules = require('./lib/modules');
    this.plugins = require('./lib/plugins');

    this.apps    = new Apps();
    this.events  = new EventEmitter();

    this.require = function(id) {
        return module.require(id);
    };

    mkdir('/etc/whaler/bin');
    fs.writeFileSync('/etc/whaler/bin/me', fs.readFileSync(__dirname + '/bin/me'));
    fs.chmodSync('/etc/whaler/bin/me', '4755');
};

module.exports = Whaler;
