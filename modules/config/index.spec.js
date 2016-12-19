'use strict';

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
    const module = rewire('./index');
    module(whaler);

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

    it('prepare config environment', function* () {
        const appName = 'prepare-config-environment';

        const app = yield storage.add.$call(storage, appName, {
            path: '/app',
            env:  'test',
            config: {}
        });

        const fsMock = {
            readFile: function (path, encoding, cb) {
                if ('/app/whaler.yml' == path) {
                    cb(null, [
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
            readFile: function (path, encoding, cb) {
                if ('/app/empty.yml' == path) {
                    cb(null, '');
                } else if ('/app/whaler.yml' == path) {
                    if ('/app/whaler.yml' == path) {
                        cb(null, [
                            'services:',
                            '    service-a:',
                            '        wait: 1000',
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
                            '        scale: 3'
                        ].join("\n"));
                    }
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
                        '"service-d3":{}',
                    '}',
                '}',
            '}'
        ].join('');
        assert.equal(JSON.stringify(config), expected);

        revert();
    });

});