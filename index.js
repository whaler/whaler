'use strict';

var fs = require('fs');
var Datastore = require('nedb');
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

    this.events  = new EventEmitter();
    this.vars    = new Datastore({
        filename: '/etc/whaler/vars.db',
        autoload: true
    });
    this.apps    = new Datastore({
        filename: '/etc/whaler/apps.db',
        autoload: true
    });

    this.require = function(id) {
        return module.require(id);
    };

    mkdir('/etc/whaler/bin');
    fs.writeFileSync('/etc/whaler/bin/me', fs.readFileSync(__dirname + '/bin/me'));
    fs.chmodSync('/etc/whaler/bin/me', '4755');
};

module.exports = Whaler;
