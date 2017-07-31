'use strict';

var fs = require('fs');
var tls = require('tls');
var pty = require('node-pty');
var Transform = require('stream').Transform;

module.exports = exports;
module.exports.__cmd = require('./cmd');

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

                    const env = data['env'] || {};
                    env.WHALER_DAEMON_DIR  = dir;
                    env.WHALER_DAEMON_NAME = data['name'];
                    
                    const opt = data['xterm'] || {};
                    opt['cwd'] = dir;
                    opt['env'] = Object.assign({}, process.env, env);

                    let timerId = null;
                    const xterm = pty.spawn(cmd, data['argv'], opt);
                    xterm.unpipe = function unpipe (dest) {
                        return xterm.socket.unpipe(dest);
                    };

                    const resize = new Transform({
                        decodeStrings: false
                    });
                    resize._transform = (chunk, encoding, done) => {
                        if (-1 !== chunk.indexOf('xterm-resize:')) {
                            const size = JSON.parse(chunk.toString().split('xterm-resize:')[1]);
                            if (timerId) {
                                clearTimeout(timerId);
                            }
                            timerId = setTimeout(() => {
                                try {
                                    xterm.resize(size.cols, size.rows);
                                } catch (e) {}
                            }, 30);

                            done(null);
                        } else {
                            done(null, chunk);
                        }
                    };

                    const exit = (code) => {
                        socket.end();
                    };

                    xterm.on('exit', exit);
                    socket.pipe(resize).pipe(xterm).pipe(socket);

                    socket.on('close', () => {
                        socket.unpipe(resize).unpipe(xterm).unpipe(socket);
                        xterm.removeListener('exit', exit);
                        xterm.kill();
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
