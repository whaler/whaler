'use strict';

var fs = require('fs');
var tls = require('tls');
var pty = require('pty.js');

var addCmd = function(whaler) {
    var pkg = require('./package.json');
    var console = whaler.require('./lib/console');

    whaler.cli.command(
        pkg.name
    ).description(
        pkg.description
    ).option(
        '--port <PORT>',
        'Port to use'
    ).action(function(options) {

        whaler.events.emit('daemon', {
            port: options.port
        }, function(err) {
            if (err) {
                return console.error('[%s] %s', process.pid, err.message, '\n');
            }
        });

    });
};

module.exports = function(whaler) {

    addCmd(whaler);

    var console = whaler.require('./lib/console');

    whaler.events.on('daemon', function(options, callback) {

        var dir = process.env.HOME + '/apps';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }

        var opts = {
            key:  fs.readFileSync('/etc/whaler/ssl/server.key'),
            cert: fs.readFileSync('/etc/whaler/ssl/server.crt'),
            ca: [
                fs.readFileSync('/etc/whaler/ssl/ca.crt')
            ],
            rejectUnauthorized: true,
            requestCert: true
        };

        var server = tls.createServer(opts, function(socket) {
            if (socket.authorized) {
                socket.once('data', function(data) {
                    data = JSON.parse(data.toString());

                    process.env.WHALER_DAEMON_DIR  = dir;
                    process.env.WHALER_DAEMON_NAME = data['name'];

                    var xterm = pty.spawn(whaler.path + '/bin/whaler', data['argv'], {
                        cwd: dir,
                        env: process.env
                    });

                    socket.pipe(xterm);
                    xterm.pipe(socket);
                    xterm.on('exit', function(code) {
                        socket.end();
                    });
                });
            }
        });

        var port = 1337;
        if (options['port']) {
            port = options['port'];
        }

        server.listen(port, function() {
            console.warn('[%s] Daemon start listening %s port.', process.pid, port);
        });
    });
};
