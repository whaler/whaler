'use strict';

var path = require('path');
var exec = require('child_process').exec;

module.exports = cursorPosition;

/**
 * @param callback
 */
function cursorPosition(callback) {
    const file = path.dirname(__dirname) + '/bin/cursor-position';
    exec(file, { timeout: 1000 }, (error, stdout, stderr) => {
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
}
