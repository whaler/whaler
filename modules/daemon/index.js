'use strict';

var fs = require('fs');
var tls = require('tls');
var pty = require('pty.js');
var Transform = require('stream').Transform;

module.exports = exports;
module.exports.__cmd = require('./cmd');
module.exports.__daemon = listener;

/**
 * @param whaler
 */
function exports(whaler) {

    whaler.on('daemon', function* (options) {
        const dir = options['dir'];
        const cmd = whaler.path + '/bin/whaler';
        const opts = {
            key:  yield fs.readFile.$call(null, '/etc/whaler/ssl/server.key'),
            cert: yield fs.readFile.$call(null, '/etc/whaler/ssl/server.crt'),
            ca: [
                yield fs.readFile.$call(null, '/etc/whaler/ssl/ca.crt')
            ],
            rejectUnauthorized: true,
            requestCert: true
        };

        try {
            yield fs.stat.$call(null, dir);
        } catch (e) {
            yield fs.mkdir.$call(null, dir);
        }

        const daemon = tls.createServer(opts, (socket) => {
            if (socket.authorized) {
                socket.once('data', (data) => {
                    data = JSON.parse(data.toString());

                    process.env.WHALER_DAEMON_DIR  = dir;
                    process.env.WHALER_DAEMON_NAME = data['name'];
                    
                    const opt = data['xterm'] || {};
                    opt['cwd'] = dir;
                    opt['env'] = process.env;

                    let timerId = null;
                    const xterm = pty.spawn(cmd, data['argv'], opt);

                    const resize = new Transform({
                        decodeStrings: false
                    });
                    resize._transform = (chunk, encoding, done) => {
                        if (-1 !== chunk.indexOf('xterm-resize:')) {
                            const size = JSON.parse(chunk.toString().split('xterm-resize:')[1]);
                            if (timerId) {
                                clearTimeout(timerId);
                            }
                            timerId = setTimeout(function() {
                                xterm.resize(size.cols - 1, size.rows - 1);
                                xterm.redraw();
                            }, 30);

                            done(null);
                        } else {
                            done(null, chunk);
                        }
                    };

                    socket.pipe(resize).pipe(xterm);
                    xterm.pipe(socket);
                    xterm.on('exit', (code) => {
                        socket.end();
                    });
                });
            }
        });

        daemon.initListeners = (cb) => {
            whaler.$async(function* () {
                yield initListeners.$call(null, whaler);
            }, cb);
        };

        return daemon;
    });

}

/**
 * @param whaler
 */
function* initListeners(whaler) {
    const listeners = [];
    const modules = whaler.get('modules');
    const plugins = whaler.get('plugins');

    for (let name of yield modules.list.$call(modules)) {
        const module = whaler.require('./modules/' + name);
        if (module['__daemon']) {
            listeners.push(module['__daemon']);
        }
    }

    for (let name of yield plugins.list.$call(plugins)) {
        try {
            const plugin = plugins.require(name);
            if (plugin['__daemon']) {
                listeners.push(plugin['__daemon']);
            }
        } catch (e) {}
    }

    const docker = whaler.get('docker');
    const stream = yield docker.getEvents.$call(docker, {
        since: Math.floor(new Date().getTime() / 1000)
    });

    stream.setEncoding('utf8');
    stream.on('data', (data) => {
        data = JSON.parse(data.toString());

        for (let listener of listeners) {
            listener(whaler, {
                type: 'events',
                data: data
            });
        }
    });
}

/**
 * @param whaler
 * @param options
 */
function listener(whaler, options) {
    if ('events' == options['type']) {
        const data = options['data'];
        if ('die' == data['status'] && 'container' == data['Type']) {
            whaler.$async(function* () {
                const docker = whaler.get('docker');
                const container = docker.getContainer(data['id']);
                try {
                    const info = yield container.inspect.$call(container);
                    if (info['Config']['Labels'] || false) {
                        const onDie = info['Config']['Labels']['whaler.on-die'] || null;
                        if ('remove' == onDie) {
                            yield container.remove.$call(container, {
                                v: true,
                                force: true
                            });
                        }
                    }
                } catch (e) {}

            });
        }
    }
}
