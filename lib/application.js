'use strict';

const compose = require('koa-compose');

const OWNER = Symbol('owner');
const TYPES = Symbol('types');
const MODULES = Symbol('modules');

class Module {
    /**
     * @api public
     */
    constructor(owner) {
        this[OWNER] = owner;
        this[TYPES] = {};
    }

    /**
     * @api public
     */
    add(type, fn) {
        if (!this[TYPES].hasOwnProperty(type)) {
            this[TYPES][type] = [];
        }
        this[TYPES][type].push(fn);

        return (/* remove */) => {
            const index = this[TYPES][type].indexOf(fn);
            if (-1 !== index) {
                this[TYPES][type].splice(index, 1);
            }
        };
    }

    /**
     * @api public
     */
    get(type) {
        if (this[TYPES].hasOwnProperty(type)) {
            return this[TYPES][type];
        }
        return [];
    }
}

class Application {
    /**
     * @api public
     */
    constructor() {
        this[MODULES] = {};
    }

    /**
     * @api private
     */
    getModule(name) {
        if (!this[MODULES][name]) {
            this[MODULES][name] = new Module(this);
        }
        return this[MODULES][name];
    }

    /**
     * @api public
     */
    before(name, fn) {
        return this.getModule(name).add('before', fn);
    }

    /**
     * @api public
     */
    after(name, fn) {
        return this.getModule(name).add('after', fn);
    }

    /**
     * @api public
     */
    on(name, fn) {
        const module = this.getModule(name);
        if (module.get('on').length) {
            throw Error('Module with name `' + name + '` already defined.');
        }
        return module.add('on', fn);
    }

    /**
     * @api public
     */
    emit(name, options, ...args) {
        const ctx = { name, options, args, result: null };
        const handler = fn => async (ctx, next) => {
            await fn(ctx);
            await next();
        };
        const module = this.getModule(name);
        const fn = compose([
            compose(module.get('before').map(handler)),
            compose(module.get('on').map(handler)),
            compose(module.get('after').map(handler))
        ]);
        return fn(ctx).then(() => ctx.result);
    }
}

module.exports = Application;
