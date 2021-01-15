'use strict';

const path = require('path');
const util = require('util');
const exec = require('child_process').exec;

module.exports = util.promisify(renderTemplate);

/**
 * @param file
 * @param env
 * @param callback
 */
function renderTemplate (file, env, callback) {
    file = path.dirname(__dirname) + '/bin/render-template ' + file;
    exec(file, { env: env }, (error, stdout, stderr) => {
        if (error) {
            return callback(error);
        }

        callback(null, stdout);
    });
}
