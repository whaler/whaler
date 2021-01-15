'use strict';

const Storage = require('../lib/storage');

const storage = new Storage(Storage.FileSystemAdapter);

module.exports = storage;