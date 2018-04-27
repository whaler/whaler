'use strict';

const fs = require('fs/promises');
const tls = require('tls');
const pty = require('node-pty');
const Transform = require('stream').Transform;

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
async function exports (whaler) {

    whaler.on('daemon', async ctx => {
        let crl = undefined;
        try {
            crl = await fs.readFile('/etc/whaler/ssl/ca.crl');
        } catch (e) {}

        const dir = ctx.options['dir'];
        const cmd = whaler.path + '/bin/whaler';
        const opts = {
            key:  await fs.readFile('/etc/whaler/ssl/server.key'),
            cert: await fs.readFile('/etc/whaler/ssl/server.crt'),
            ca: [
                await fs.readFile('/etc/whaler/ssl/ca.crt')
            ],
            crl: crl,
            rejectUnauthorized: true,
            requestCert: true
        };

        try {
            await fs.stat(dir);
        } catch (e) {
            await fs.mkdir(dir);
        }

        const daemon = tls.createServer(opts, socket => {
            if (socket.authorized) {
                socket.once('data', data => {
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
                        return this.socket.unpipe(dest);
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

                    const exit = code => {
                        socket.end();
                    };

                    xterm.on('exit', exit);
                    socket.pipe(resize).pipe(xterm).pipe(socket);

                    socket.on('close', () => {
                        socket.unpipe(resize).unpipe(xterm).unpipe(socket);
                        xterm.removeListener('exit', exit);
                        xterm.kill('SIGINT');
                    });
                });
            }
        });

        daemon.initListeners = async () => {
            const listeners = [];
            const { default: modules } = await whaler.fetch('modules');
            const { default: plugins } = await whaler.fetch('plugins');

            for (let name of await modules.list()) {
                const module = await modules.import(name);
                if (module['__daemon']) {
                    listeners.push(module['__daemon']);
                }
            }

            for (let name of await plugins.list()) {
                try {
                    const plugin = await plugins.import(name);
                    if (plugin['__daemon']) {
                        listeners.push(plugin['__daemon']);
                    }
                } catch (e) {}
            }

            const { default: docker } = await whaler.fetch('docker');
            const stream = await docker.getEvents({
                since: Math.floor(new Date().getTime() / 1000)
            });

            stream.setEncoding('utf8');
            stream.on('data', data => {
                data = JSON.parse(data.toString());

                for (let listener of listeners) {
                    listener(whaler, {
                        type: 'events',
                        data: data
                    });
                }
            });
        };

        ctx.result = daemon;
    });

}
