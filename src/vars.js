'use strict';

const util = require('util');
const storage = require('./storage');

const STORAGE = Symbol('storage');

const errors = {
    'ERR_NOT_FOUND': 'An var with `%s` name not found.'
};

class Vars {
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
        const vars = {};
        const data = await this[STORAGE]('all');
        for (let name in data) {
            vars[name] = data[name]['value'] || '';
        }
        return vars;
    }

    async get(name) {
        let data = {};
        try {
            data = await this[STORAGE]('get', name);
        } catch (e) {}
        return data['value'] || '';
    }

    async set(name, value) {
        value = value || '';
        const data = await this[STORAGE]('set', name, { value });
        return data['value'] || '';
    }

    async unset(name) {
        try {
            await this[STORAGE]('remove', name);
        } catch (e) {}
    }
}

module.exports = new Vars('vars');
module.exports.Vars = Vars;
