'use strict';

var fs = require('fs');
var path = require('path');

var getModules = function() {
    var data = {};
    var dir = path.dirname(__dirname) + '/modules';
    var list = fs.readdirSync(dir);
    list.forEach(function(name) {
        var path = dir + '/' + name;
        var stat = fs.statSync(path);
        if (stat && stat.isDirectory()) {
            data[name] = path;
        }
    });
    return data;
};

var Modules = function() {
    this._modules = getModules();
};

Modules.prototype.package = function(name, callback) {
    var pkg = require(this._modules[name] + '/package.json');
    callback(null, pkg);
};

Modules.prototype.list = function(callback) {
    var data = [];
    for (var name in this._modules) {
        data.push(name);
    }
    callback(null, data);
};

module.exports = new Modules();
