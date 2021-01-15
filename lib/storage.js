'use strict';

const path = require('path');
const util = require('util');
const crypto = require('crypto');
const fs = require('fs').promises;
const stackTrace = require('stack-trace');

const filenameReservedRegex = /[<>:"/\\|?*\u0000-\u001F]/g;

const md5 = data => crypto.createHash('md5').update(data).digest('hex');

class StorageError extends Error {
    /**
     * @param {string} message
     * @param {string} code
     */
    constructor(message, code) {
        super(message);
        this.name = 'StorageError';
        this.code = code;
    }
}

class NotImplementedError extends StorageError {
    constructor() {
        const trace = stackTrace.parse(new Error('not-implemented'));
        trace.shift();
        super(util.format('`%s` isn\'t implemented.', trace[0]['functionName']), 'ERR_NOT_IMPLEMENTED');
    }
}

class BaseAdapter {
    async *[Symbol.asyncIterator]() {
        const db = await this.all();
        for (let key in db) {
            yield [key, db[key]];
        }
    }

    /**
     * @returns {Promise.<Object>}
     */
    async all() {
        throw new NotImplementedError();
    }

    /**
     * @param {string} key
     * @returns {Promise.<Object>}
     */
    async get(key) {
        throw new NotImplementedError();
    }

    /**
     * @param {string} key
     * @param {Object} value
     * @returns {Promise.<Object>}
     */
    async set(key, value) {
        throw new NotImplementedError();
    }

    /**
     * @param {string} key
     * @param {Object} value
     * @returns {Promise.<Object>}
     */
    async insert(key, value) {
        throw new NotImplementedError();
    }

    /**
     * @param {string} key
     * @param {Object} value
     * @returns {Promise.<Object>}
     */
    async update(key, value) {
        throw new NotImplementedError();
    }

    /**
     * @param {string} key
     */
    async remove(key) {
        throw new NotImplementedError();
    }
}

class InMemoryAdapter extends BaseAdapter {
    /**
     * @param {string} name
     */
    constructor(/* name */) {
        super();
        this.db = {};
    }

    /**
     * @private
     */
    exists(key) {
        return this.db.hasOwnProperty(key);
    }

    /**
     * @returns {Promise.<Object>}
     */
    async all() {
        return this.db;
    }

    /**
     * @param {string} key
     * @returns {Promise.<Object>}
     */
    async get(key) {
        if (!this.exists(key)) {
            throw new StorageError(util.format('`%s` not found.', key), 'ERR_NOT_FOUND');
        }
        return this.db[key];
    }

    /**
     * @param {string} key
     * @param {Object} value
     * @returns {Promise.<Object>}
     */
    async set(key, value) {
        return this.db[key] = value;
    }

    /**
     * @param {string} key
     * @param {Object} value
     * @returns {Promise.<Object>}
     */
    async insert(key, value) {
        if (this.exists(key)) {
            throw new StorageError(util.format('`%s` already exists.', key), 'ERR_ALREADY_EXISTS');
        }
        return this.set(key, value);
    }

    /**
     * @param {string} key
     * @param {Object} value
     * @returns {Promise.<Object>}
     */
    async update(key, value) {
        const data = await this.get(key);
        return this.set(key, { ...data, ...value });
    }

    /**
     * @param {string} key
     */
    async remove(key) {
        if (!this.exists(key)) {
            throw new StorageError(util.format('`%s` not found.', key), 'ERR_NOT_FOUND');
        }
        delete this.db[key];
    }
}

class FileSystemAdapter extends BaseAdapter {
    /**
     * @param {string} name
     */
    constructor(name) {
        super();
        this.path = path.join('/var/lib/whaler/storage/fs', name);
    }

    /**
     * @private
     */
    getFilePath(key) {
        const fileName = md5(key).substr(0, 7) + '@' +  key.replace(filenameReservedRegex, '_');
        return path.join(this.path, fileName);
    }

    /**
     * @private
     */
    async exists(key) {
        try {
            await fs.stat(this.getFilePath(key));
            return true;
        } catch (e) {}
        return false;
    }

    /**
     * @returns {Promise.<Object>}
     */
    async all() {
        const db = {};
        try {
            const arr = await fs.readdir(this.path);
            for (let fileName of arr) {
                const filePath = path.join(this.path, fileName);
                try {
                    const content = await fs.readFile(filePath, 'utf8');
                    const data = JSON.parse(content);
                    db[data['key']] = data['value'];
                } catch (e) {}
            }
        } catch (e) {}
        return db;
    }

    /**
     * @param {string} key
     * @returns {Promise.<Object>}
     */
    async get(key) {
        if (await this.exists(key)) {
            const content = await fs.readFile(this.getFilePath(key), 'utf8');
            const data = JSON.parse(content);
            return data['value'];
        }
        throw new StorageError(util.format('`%s` not found.', key), 'ERR_NOT_FOUND');
    }

    /**
     * @param {string} key
     * @param {Object} value
     * @returns {Promise.<Object>}
     */
    async set(key, value) {
        await fs.mkdir(this.path, { recursive: true });
        await fs.writeFile(this.getFilePath(key), JSON.stringify({ key, value }, null, ' '.repeat(4)));
        return value;
    }

    /**
     * @param {string} key
     * @param {Object} value
     * @returns {Promise.<Object>}
     */
    async insert(key, value) {
        if (await this.exists(key)) {
            throw new StorageError(util.format('`%s` already exists.', key), 'ERR_ALREADY_EXISTS');
        }
        return this.set(key, value);
    }

    /**
     * @param {string} key
     * @param {Object} value
     * @returns {Promise.<Object>}
     */
    async update(key, value) {
        const data = await this.get(key);
        return this.set(key, { ...data, ...value });
    }

    /**
     * @param {string} key
     */
    async remove(key) {
        if (await this.exists(key)) {
            return fs.unlink(this.getFilePath(key));
        }
        throw new StorageError(util.format('`%s` not found.', key), 'ERR_NOT_FOUND');
    }
}

class Storage {
    /**
     * @param {mixed} adapter
     */
    constructor(adapter = InMemoryAdapter) {
        this.adapter = adapter;
    }

    /**
     * @param {string} name
     * @returns {mixed}
     */
    create(name) {
        if (name) {
            return new this.adapter(name);
        }
        return new InMemoryAdapter(); // for tests
    }
}

Storage.Error = StorageError;
Storage.InMemoryAdapter = InMemoryAdapter;
Storage.FileSystemAdapter = FileSystemAdapter;

module.exports = Storage;