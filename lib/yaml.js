'use strict';

const yaml = require('js-yaml');
const unsafe = require('js-yaml-js-types').all;

const schema = yaml.DEFAULT_SCHEMA.extend(unsafe);

module.exports = {
    load: (string, options = {}) => {
        return yaml.load(string, { schema, ...options });
    },
    dump: (object, options = {}) => {
        return yaml.dump(object, { indent: 2, ...options });
    }
};