'use strict';

const util = require('util');
const yaml = require('../lib/yaml');
const storage = require('./storage');

const STORAGE = Symbol('storage');

const errors = {
    'ERR_NOT_FOUND': 'An application with `%s` name not found.',
    'ERR_ALREADY_EXISTS': 'An application with `%s` name already exists.'
};

class Apps {
    constructor(name) {
        const adapter = storage.create(name);
        this[STORAGE] = async (method, ...args) => {
            try {
                return adapter[method](...args);
            } catch (e) {
                if (args.length && e.hasOwnProperty('code') && Object.keys(errors).includes(e.code)) {
                    e.message = util.format(errors[e.code], args[0]);
                }
                throw e;
            }
        };
    }

    async *[Symbol.asyncIterator]() {
        const data = await this.all();
        for (let name in data) {
            yield [name, data[name]];
        }
    }

    async all() {
        const data = await this[STORAGE]('all');
        for (let name in data) {
            data[name] = prepareDataToGet(data[name]);
        }
        return data;
    }

    async get(name) {
        const data = await this[STORAGE]('get', name);
        return prepareDataToGet(data);
    }

    async add(name, data) {
        data = await this[STORAGE]('insert', name, prepareDataToSet(data));
        return prepareDataToGet(data);
    }

    async update(name, data) {
        data = await this[STORAGE]('update', name, prepareDataToSet(data));
        return prepareDataToGet(data);
    }

    async remove(name) {
        await this[STORAGE]('remove', name);
    }
}

module.exports = new Apps('apps');
module.exports.Apps = Apps;

// PRIVATE

/**
 * @param data
 * @returns {*}
 */
function prepareDataToSet (data) {
    const result = { ...data };
    if (data && data['config']) {
        result['config'] = { ...data['config'] };
        if (data['config']['data']) {
            if ('string' !== typeof data['config']['data']) {
                result['config']['data'] = yaml.dump(data['config']['data']);
            }
        } else {
            result['config']['data'] = '';
        }
    }
    return result;
}

/**
 * @param data
 * @returns {*}
 */
function prepareDataToGet (data) {
    const result = { ...data };
    if (data && data['config']) {
        result['config'] = { ...data['config'] };
        if (data['config']['data']) {
            if ('string' === typeof data['config']['data']) {
                result['config']['data'] = yaml.load(data['config']['data']);
            }
        } else {
            result['config']['data'] = {
                services: {}
            };
        }
    }
    return result;
}
