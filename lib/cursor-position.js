'use strict';

var path = require('path');
var exec = require('child_process').exec;

module.exports = function(callback) {
    exec(path.dirname(__dirname) + '/bin/cursor-position', { timeout: 1000 }, function(error, stdout, stderr) {
        if (process.stdout.isTTY) {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
        }

        if (error) {
            return callback(error);
        }

        try {
            callback(null, JSON.parse(stdout));
        } catch (err) {
            callback(err);
        }
    });
};
