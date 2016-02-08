'use strict';

var fs = require('fs');
var tls = require('tls');
var pty = require('pty.js');

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

        return tls.createServer(opts, (socket) => {
            if (socket.authorized) {
                socket.once('data', (data) => {
                    data = JSON.parse(data.toString());

                    process.env.WHALER_DAEMON_DIR  = dir;
                    process.env.WHALER_DAEMON_NAME = data['name'];

                    var xterm = pty.spawn(cmd, data['argv'], {
                        cwd: dir,
                        env: process.env
                    });

                    socket.pipe(xterm);
                    xterm.pipe(socket);
                    xterm.on('exit', (code) => {
                        socket.end();
                    });
                });
            }
        });
    });

}
