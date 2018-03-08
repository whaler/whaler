'use strict';

const compose = require('koa-compose');
const deprecate = require('./deprecate');

// TODO: remove in v1
const co = require('co');
const $ = require('x-node');

$.deprecate = () => null;
Function.prototype.$isGenerator = function() { $.deprecate(); return $.isGenerator(this); };
Function.prototype.$call = function(thisArg) { $.deprecate(); return $.apply(this, thisArg, [].slice.call(arguments).slice(1)); };
Function.prototype.$apply = function(thisArg, argsArray) { $.deprecate(); return $.apply(this, thisArg, argsArray); };
Function.prototype.$async = function(callback) { $.deprecate(); return $.async(this, callback); };
// end

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
        // TODO: remove in v1
        if (fn instanceof (function * () {}).constructor) {
            this[OWNER].deprecate(deprecate('"%s" support for generators will be removed in v1.', 1));
        }

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

        // TODO: remove in v1
        $.deprecate = () => this.deprecate(deprecate(undefined, 1));
    }

    /**
     * @api private
     */
    deprecate(message) {
        return this.emit('deprecate', { message });
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
            throw Error('Module with name "' + name + '" already defined.');
        }
        return module.add('on', fn);
    }

    /**
     * @api public
     */
    emit(name, options, ...args) {
        const ctx = { name, options, args, result: null };
        const handler = fn => async (ctx, next) => {
            // TODO: remove in v1
            if (fn instanceof (function * () {}).constructor) {
                const result = await co.wrap(fn)(ctx.options);
                if (result) {
                    ctx.result = result;
                }
            } else {
                await fn(ctx);
            }
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

    // TODO: remove in v1
    $emit(name, options) {
        this.deprecate(deprecate());
        return this.emit(name, options);
    }

    // TODO: remove in v1
    $async(gen, callback) {
        this.deprecate(deprecate());
        gen.$async(callback)();
    }

    // TODO: refactor in v1
    get(id) {
        this.deprecate(deprecate('"%s" starting from v1, will return promise for "fetch(\'' + id + '\').then(result => result.default)"'));
        return this._require('./src/' + id);
    }

    // TODO: remove in v1
    require(id) {
        this.deprecate(deprecate());
        return this._require(id);
    }
}

module.exports = Application;
