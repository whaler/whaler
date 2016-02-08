'use strict';

var fs = require('fs');
var path = require('path');

module.exports = new Modules();

function Modules() {
    this._modules = getModules();
}

Modules.prototype.package = function(name, callback) {
    const pkg = require(this._modules[name] + '/package.json');
    callback(null, pkg);
};

Modules.prototype.list = function(callback) {
    const data = [];
    for (let name in this._modules) {
        data.push(name);
    }
    callback(null, data);
};

// PRIVATE

function getModules() {
    const data = {};
    const dir = path.dirname(__dirname) + '/modules';
    const list = fs.readdirSync(dir);
    for (let name of list) {
        const path = dir + '/' + name;
        const stat = fs.statSync(path);
        if (stat && stat.isDirectory()) {
            data[name] = path;
        }
    }
    return data;
}
