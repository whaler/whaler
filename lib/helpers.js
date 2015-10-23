'use strict';

var path = require('path');

var getName = function(value) {
    return value || path.basename(process.cwd());
};

var getRef = function(value) {
    if (value) {
        var parts = value.split('.');
        if (2 == parts.length) {
            if (!parts[1]) {
                value += path.basename(process.cwd());
            }
        }
        return value;
    }
    return path.basename(process.cwd());
};

var getPath = function(value) {
    value = value || process.cwd();
    if (!path.isAbsolute(value)) {
        value = path.join(process.cwd(), path.normalize(value));
    }
    return value;
};

var getDockerFiltersNamePattern = function(appName) {
    return '^\/[a-z0-9\-]+[\.]{1}' + appName + '$';
};

module.exports = {
    getName: getName,
    getRef: getRef,
    getPath: getPath,
    getDockerFiltersNamePattern: getDockerFiltersNamePattern
};
