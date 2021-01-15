'use strict';

const fs = require('fs').promises;
const path = require('path');

class Modules {
    /**
     * @api public
     * @param id
     */
    static async import(id) {
        if (module.import) {
            return await module.import(id);
        }
        return { default: module.require(id) };
    }

    /**
     * @api public
     */
    constructor() {
        this._modules = getModules();
    }

    /**
     * @api
     * @param name
     */
    async import(name) {
        return await Modules.import(path.join('..', 'modules', name));
    }

    /**
     * @api public
     */
    async package(name) {
        const modules = await this._modules;
        const { default: pkg } = await this.import(path.join(modules[name], 'package.json'));
        return pkg;
    }

    /**
     * @api public
     */
    async list() {
        const data = [];
        const modules = await this._modules;
        for (let name in modules) {
            data.push(name);
        }
        return data;
    }
}

module.exports = new Modules();

// PRIVATE

async function getModules () {
    const data = {};
    const dir = path.join(path.dirname(__dirname), 'modules');
    const list = await fs.readdir(dir);
    for (let name of list) {
        const path = dir + '/' + name;
        const stat = await fs.stat(path);
        if (stat && stat.isDirectory()) {
            data[name] = path;
        }
    }
    return data;
}
