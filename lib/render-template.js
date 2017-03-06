'use strict';

var path = require('path');
var exec = require('child_process').exec;

module.exports = renderTemplate;

/**
 * @param file
 * @param env
 * @param callback
 */
function renderTemplate(file, env, callback) {
    file = path.dirname(__dirname) + '/bin/render-template ' + file;
    exec(file, { env: env }, (error, stdout, stderr) => {
        if (error) {
            return callback(error);
        }

        callback(null, stdout);
    });
}
