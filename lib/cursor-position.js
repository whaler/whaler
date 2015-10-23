'use strict';

var path = require('path');
var exec = require('child_process').exec;

module.exports = function(callback) {
    exec(path.dirname(__dirname) + '/bin/cursor-position', function(error, stdout, stderr) {
        callback(error, JSON.parse(stdout));
    });
};
