'use strict';

var fs = require('fs');
var colors = require('colors/safe');

var prepareLogo = function(logo) {
    var logo = fs.readFileSync(__dirname + '/logo.txt', 'utf8');

    var data = logo.split('\n');
    data.forEach(function(line, index) {
        data[index] = line.length ? colors.blue(line) : line;
    });

    return data;
};

var prepareInfo = function() {
    var pkg = require('./package.json');
    var info = fs.readFileSync(__dirname + '/info.txt', 'utf8');

    info = info.replace('[url]', colors.yellow('URL: ') + pkg.homepage);
    info = info.replace('[author]', colors.yellow('Author: ') + pkg.author.name);
    info = info.replace('[version]', colors.yellow('Version: ') + pkg.version);

    var data = info.split('\n');
    data.every(function(line, index) {
        if (!line.length) {
            return false;
        }
        data[index] = colors.cyan(line);

        return true;
    });

    return data;
};

module.exports = function() {
    var logo = prepareLogo();
    var info = prepareInfo();

    var data = [];
    var l = logo.length;
    if (info.length > l) {
        l = info.length;
    }
    for (var i = 0; i < l; i++) {
        data.push((logo[i] || '') + (info[i] || ''));
    }

    return data.join('\n');
}();
