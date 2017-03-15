'use strict';

var fs = require('fs');
var colors = require('colors/safe');
var docker = require('./docker');

module.exports = header();

/**
 * @returns {string}
 */
function header() {
    const logo = prepareLogo();
    const info = prepareInfo();

    const data = [];
    let l = logo.length;
    if (info.length > l) {
        l = info.length;
    }
    for (let i = 0; i < l; i++) {
        data.push((logo[i] || '') + (info[i] || ''));
    }

    return data.join('\n');
}

/**
 * @param logo
 * @returns {Array}
 */
function prepareLogo() {
    const logo = fs.readFileSync(__dirname + '/../logo.txt', 'utf8');

    const data = logo.split('\n');
    data.forEach((line, index) => {
        data[index] = line.length ? colors.blue(line) : line;
    });

    return data;
}

/**
 * @returns {Array}
 */
function prepareInfo() {
    const pkg = require('../package.json');
    let info = fs.readFileSync(__dirname + '/../info.txt', 'utf8');

    let version = pkg.version;
    let dockerAPI = false;
    try {
        const dev = require('../dev.json');
        version = dev.version + (dev.sha ? ' ' + colors.gray(dev.sha.substr(0, 7)) : '');
        dockerAPI = docker.modem.version.substr(1, docker.modem.version.length);
    } catch(e) {}

    info = info.replace('[url]', colors.yellow('URL: ') + pkg.homepage);
    info = info.replace('[author]', colors.yellow('Author: ') + pkg.author.name);
    info = info.replace('[version]', colors.yellow('Version: ') + version);
    info = info.replace('[dockerAPI]', dockerAPI ? colors.yellow('Docker API: ') + dockerAPI : '');

    const data = info.split('\n');
    data.every((line, index) => {
        if (!line.length) {
            return false;
        }
        data[index] = colors.cyan(line);

        return true;
    });

    return data;
}
