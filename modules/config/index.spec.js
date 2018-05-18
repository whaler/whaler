'use strict';

const fs = require('fs').promises;
const util = require('util');
const rewire = require('rewire');
const assert = require('chai').assert;

const promisify = require('../../lib/promisify');
const Whaler = require('../../index');
const Apps = require('../../src/apps').Apps;

const storage = promisify(new Apps());

class TestWhaler extends Whaler {
    async fetch(id) {
        if ('apps' == id) {
            return { default: storage };
        }

        throw new Error('whaler.fetch("' + id + '") not specified');
    }
}

describe('modules/config', () => {
    const whaler = new TestWhaler();

    whaler.on('vars', async ctx => {
        ctx.result = {
            GLOBAL: 'global',
            UNUSED: 'unused',
            FILE: 'file'
        };
    });

    const module = rewire('./index');
    module(whaler);

    const _renderTemplate = module.__get__('renderTemplate');
    const revertRenderTemplate = module.__set__('renderTemplate', async (file, vars) => {
        const tmpFile = '/tmp/whaler.yml';
        const _fs = module.__get__('fs');
        let yml = await _fs.readFile(file, 'utf8');

        await fs.writeFile(tmpFile, yml, 'utf8');
        const data = await _renderTemplate(tmpFile, vars);
        await fs.unlink(tmpFile);

        return data;
    });

    it('app not found', async () => {
        let hasError = false;
        try {
            await whaler.emit('config', { name: 'undefined' });
        } catch (e) {
            hasError = true;
        }

        assert.equal(hasError, true);
    });

    it('prepare config vars', async () => {
        const appName = 'prepare-config-vars';

        const app = await storage.add(appName, {
            path: '/app',
            env:  'test',
            config: {}
        });

        const fsMock = {
            stat: async path => {
                if ('/app/whaler.yml' == path) {
                    return {};
                }

                throw new Error('file "' + path + '" not found');
            },
            readFile: async path => {
                if ('/app/whaler.yml' == path) {
                    return [
                        'app_name: ${APP_NAME}',
                        'app_path: ${APP_PATH}',
                        'app_env: ${APP_ENV}',
                        'undefined: ${UNDEFINED:=undefined}',
                        'global: ${GLOBAL:=undefined}',
                        'file: ${FILE:=undefined}',
                        'null: ${NULL}'
                    ].join('\n');
                }
                if ('/app/.env' == path) {
                    return [
                        'UNUSED=file',
                        'FILE=file'
                    ].join('\n');
                }

                throw new Error('file "' + path + '" not found');
            }
        };
        const revert = module.__set__('fs', fsMock);

        let config;
        let expected;

        config = await whaler.emit('config', {
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
                    '"app_env":"dev",',
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

    it('prepare config environment', async () => {
        const appName = 'prepare-config-environment';

        const app = await storage.add(appName, {
            path: '/app',
            env:  'test',
            config: {}
        });

        const fsMock = {
            stat: async path => {
                if ('/app/whaler.yml' == path) {
                    return {};
                }

                throw new Error('file "' + path + '" not found');
            },
            readFile: async path => {
                if ('/app/whaler.yml' == path) {
                    return [
                        'x:',
                        '    foo: bar',
                        '    ~dev,test:',
                        '        foo: baz',
                        '~extra:',
                        '    z:',
                        '        foo: extra',
                        'y:',
                        '    foo: bar',
                        '~prod:',
                        '    y:',
                        '        foo: baz',
                        '    z:',
                        '        foo: qux'
                    ].join('\n');
                }

                throw new Error('file "' + path + '" not found');
            }
        };
        const revert = module.__set__('fs', fsMock);

        let config;
        let expected;

        config = await whaler.emit('config', {
            name: appName,
            setEnv: 'dev',
            update: true
        });
        expected = '{"file":"/app/whaler.yml","data":{"x":{"foo":"baz"},"y":{"foo":"bar"},"services":{}}}';
        assert.equal(JSON.stringify(config), expected);

        config = await whaler.emit('config', {
            name: appName,
            setEnv: 'prod',
            update: true
        });
        expected = '{"file":"/app/whaler.yml","data":{"x":{"foo":"bar"},"y":{"foo":"baz"},"z":{"foo":"qux"},"services":{}}}';
        assert.equal(JSON.stringify(config), expected);

        config = await whaler.emit('config', {
            name: appName,
            setEnv: 'test',
            update: true
        });
        expected = '{"file":"/app/whaler.yml","data":{"x":{"foo":"baz"},"y":{"foo":"bar"},"services":{}}}';
        assert.equal(JSON.stringify(config), expected);

        config = await whaler.emit('config', {
            name: appName,
            setEnv: 'dev,extra',
            update: true
        });
        expected = '{"file":"/app/whaler.yml","data":{"x":{"foo":"baz"},"z":{"foo":"extra"},"y":{"foo":"bar"},"services":{}}}';
        assert.equal(JSON.stringify(config), expected);

        config = await whaler.emit('config', {
            name: appName,
            setEnv: 'prod,extra',
            update: true
        });
        expected = '{"file":"/app/whaler.yml","data":{"x":{"foo":"bar"},"z":{"foo":"qux"},"y":{"foo":"baz"},"services":{}}}';
        assert.equal(JSON.stringify(config), expected);

        config = await whaler.emit('config', {
            name: appName,
            setEnv: 'test,extra',
            update: true
        });
        expected = '{"file":"/app/whaler.yml","data":{"x":{"foo":"baz"},"z":{"foo":"extra"},"y":{"foo":"bar"},"services":{}}}';
        assert.equal(JSON.stringify(config), expected);

        revert();
    });

    it('prepare config services', async () => {
        const appName = 'prepare-config-services';

        const app = await storage.add(appName, {
            path: '/app',
            env:  'test',
            config: {}
        });

        const fsMock = {
            stat: async path => {
                if ('/app/empty.yml' == path) {
                    return {};
                } else if ('/app/whaler.yml' == path) {
                    return {};
                }

                throw new Error('file "' + path + '" not found');
            },
            readFile: async path => {
                if ('/app/empty.yml' == path) {
                    return '';
                } else if ('/app/whaler.yml' == path) {
                    return [
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
                    ].join('\n');
                }

                throw new Error('file "' + path + '" not found');
            }
        };
        const revert = module.__set__('fs', fsMock);

        let config;
        let expected;

        config = await whaler.emit('config', {
            name: appName
        });
        expected = '{"data":{"services":{}}}';
        assert.equal(JSON.stringify(config), expected);

        config = await whaler.emit('config', {
            name: appName,
            file: '/app/empty.yml'
        });

        expected = '{"file":"/app/empty.yml","data":{"services":{}}}';
        assert.equal(JSON.stringify(config), expected);

        config = await whaler.emit('config', {
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