'use strict';

var fs = require('fs');
var util = require('util');
var rewire = require('rewire');
var assert = require('chai').assert;

var Apps = require('../../src/apps').Apps;
var storage = new Apps();

function Whaler() {}
util.inherits(Whaler, require('../../index'));
Whaler.prototype.get = function(id) {
    if ('apps' == id) {
        return storage;
    }

    throw new Error('whaler.get("' + id + '") not specified');
};

describe('modules/config', () => {
    const whaler = new Whaler();

    whaler.on('vars', function* () {
        return {
            GLOBAL: 'global',
            UNUSED: 'global',
            FILE: 'global'
        };
    });

    const module = rewire('./index');
    module(whaler);

    const _renderTemplate = module.__get__('renderTemplate');
    const revertRenderTemplate = module.__set__('renderTemplate', function* (file, vars) {
        const tmpFile = '/tmp/whaler.yml';
        const _fs = module.__get__('fs');
        let yml = yield _fs.readFile.$call(null, file, 'utf8');

        yield fs.writeFile.$call(null, tmpFile, yml, 'utf8');
        const data = yield _renderTemplate.$call(null, tmpFile, vars);
        yield fs.unlink.$call(null, tmpFile);

        return data;
    });

    it('app not found', function* () {
        let hasError = false;
        try {
            yield whaler.$emit('config', {
                name: 'undefined'
            });
        } catch (e) {
            hasError = true;
        }

        assert.equal(hasError, true);
    });

    it('prepare config vars', function* () {
        const appName = 'prepare-config-vars';

        const app = yield storage.add.$call(storage, appName, {
            path: '/app',
            env:  'test',
            config: {}
        });

        const fsMock = {
            stat: function (path, cb) {
                if ('/app/whaler.yml' == path) {
                    return cb(null, {});
                }

                cb(new Error('file "' + path + '" not found'));
            },
            readFile: function (path, encoding, cb) {
                if ('/app/whaler.yml' == path) {
                    return cb(null, [
                        'app_name: ${APP_NAME}',
                        'app_path: ${APP_PATH}',
                        'undefined: ${UNDEFINED:=undefined}',
                        'global: ${GLOBAL:=undefined}',
                        'file: ${FILE:=undefined}',
                        'null: ${NULL}'
                    ].join("\n"));
                }
                if ('/app/.env' == path) {
                    return cb(null, [
                        'UNUSED=file',
                        'FILE=file'
                    ].join("\n"));
                }

                cb(new Error('file "' + path + '" not found'));
            }
        };
        const revert = module.__set__('fs', fsMock);

        let config;
        let expected;

        config = yield whaler.$emit('config', {
            name: appName,
            setEnv: 'dev',
            update: true
        });

        expected = [
            '{',
                '"file":"/app/whaler.yml",',
                '"data":{',
                    '"app_name":"' + appName + '",',
                    '"app_path":"/app",',
                    '"undefined":"undefined",',
                    '"global":"global",',
                    '"file":"file",',
                    '"null":null,',
                    '"services":{}',
                '}',
            '}'
        ].join('');
        assert.equal(JSON.stringify(config), expected);

        revert();
    });

    it('prepare config environment', function* () {
        const appName = 'prepare-config-environment';

        const app = yield storage.add.$call(storage, appName, {
            path: '/app',
            env:  'test',
            config: {}
        });

        const fsMock = {
            stat: function (path, cb) {
                if ('/app/whaler.yml' == path) {
                    return cb(null, {});
                }

                cb(new Error('file "' + path + '" not found'));
            },
            readFile: function (path, encoding, cb) {
                if ('/app/whaler.yml' == path) {
                    return cb(null, [
                        'x:',
                        '    foo: bar',
                        '    ~dev:',
                        '        foo: baz',
                        'y:',
                        '    foo: bar',
                        '~prod:',
                        '    y:',
                        '        foo: baz',
                        '    z:',
                        '        foo: qux'
                    ].join("\n"));
                }

                cb(new Error('file "' + path + '" not found'));
            }
        };
        const revert = module.__set__('fs', fsMock);

        let config;
        let expected;

        config = yield whaler.$emit('config', {
            name: appName,
            setEnv: 'dev',
            update: true
        });

        expected = '{"file":"/app/whaler.yml","data":{"x":{"foo":"baz"},"y":{"foo":"bar"},"services":{}}}';
        assert.equal(JSON.stringify(config), expected);

        config = yield whaler.$emit('config', {
            name: appName,
            setEnv: 'prod',
            update: true
        });
        expected = '{"file":"/app/whaler.yml","data":{"x":{"foo":"bar"},"y":{"foo":"baz"},"z":{"foo":"qux"},"services":{}}}';
        assert.equal(JSON.stringify(config), expected);

        config = yield whaler.$emit('config', {
            name: appName,
            setEnv: 'test',
            update: true
        });
        expected = '{"file":"/app/whaler.yml","data":{"x":{"foo":"bar"},"y":{"foo":"bar"},"services":{}}}';
        assert.equal(JSON.stringify(config), expected);

        revert();
    });

    it('prepare config services', function* () {
        const appName = 'prepare-config-services';

        const app = yield storage.add.$call(storage, 'prepare-config-services', {
            path: '/app',
            env:  'test',
            config: {}
        });

        const fsMock = {
            stat: function (path, cb) {
                if ('/app/empty.yml' == path) {
                    return cb(null, {});
                } else if ('/app/whaler.yml' == path) {
                    return cb(null, {});
                }

                cb(new Error('file "' + path + '" not found'));
            },
            readFile: function (path, encoding, cb) {
                if ('/app/empty.yml' == path) {
                    return cb(null, '');
                } else if ('/app/whaler.yml' == path) {
                    return cb(null, [
                        'services:',
                        '    service-a:',
                        '        wait: 1000',
                        '        ports:',
                        '            - 3000:3000',
                        '        volumes:',
                        '            /tmp:',
                        '            /from-a: /to-a',
                        '            ./cache: /cache',
                        '        env:',
                        '            RACK_ENV: development',
                        '            SHOW: \'true\'',
                        '            SESSION_SECRET:',
                        '    service-b:',
                        '        extend: service-a',
                        '        volumes:',
                        '            /from-b: /to-b',
                        '    service-c:',
                        '        wait: 1m',
                        '        volumes:',
                        '            - /from-c:/to-c',
                        '        env:',
                        '            - FOO=foo',
                        '            - BAR=bar',
                        '            - BAZ',
                        '    service-d:',
                        '        scale: 3',
                        '    service-e:',
                        '        extend: service-a&wait',
                        '    service-f:',
                        '        extend: service-a!wait'
                    ].join("\n"));
                }

                cb(new Error('file "' + path + '" not found'));
            }
        };
        const revert = module.__set__('fs', fsMock);

        let config;
        let expected;

        config = yield whaler.$emit('config', {
            name: appName
        });
        expected = '{"data":{"services":{}}}';
        assert.equal(JSON.stringify(config), expected);

        config = yield whaler.$emit('config', {
            name: appName,
            file: '/app/empty.yml'
        });

        expected = '{"file":"/app/empty.yml","data":{"services":{}}}';
        assert.equal(JSON.stringify(config), expected);

        config = yield whaler.$emit('config', {
            name: appName,
            file: '/app/whaler.yml',
            update: true
        });

        expected = [
            '{',
                '"file":"/app/whaler.yml",',
                '"data":{',
                    '"services":{',
                        '"service-a":{',
                            '"wait":"1000s",',
                            '"ports":["3000:3000"],',
                            '"volumes":["/tmp","/from-a:/to-a","./cache:/cache"],',
                            '"env":["RACK_ENV=development","SHOW=true","SESSION_SECRET"]',
                        '},',
                        '"service-b":{',
                            '"wait":"1000s",',
                            '"volumes":["/from-b:/to-b"],',
                            '"env":["RACK_ENV=development","SHOW=true","SESSION_SECRET"]',
                        '},',
                        '"service-c":{',
                            '"wait":"1m",',
                            '"volumes":["/from-c:/to-c"],',
                            '"env":["FOO=foo","BAR=bar","BAZ"]',
                        '},',
                        '"service-d1":{},',
                        '"service-d2":{},',
                        '"service-d3":{},',
                        '"service-e":{',
                            '"wait":"1000s"',
                        '},',
                        '"service-f":{',
                            '"volumes":["/tmp","/from-a:/to-a","./cache:/cache"],',
                            '"env":["RACK_ENV=development","SHOW=true","SESSION_SECRET"]',
                        '}',
                    '}',
                '}',
            '}'
        ].join('');

        assert.equal(JSON.stringify(config), expected);

        revert();
    });

});