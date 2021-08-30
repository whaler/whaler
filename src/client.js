'use strict';

const fs = require('fs');
const tls = require('tls');
const path = require('path');

module.exports = client;

/**
 * @param host
 * @param argv
 */
function client (host, argv) {
    let port = 1337;

    const arr = host.split(':');
    if (2 == arr.length) {
        host = arr[0];
        port = arr[1];
    }

    let key, cert;
    try {
        key = fs.readFileSync(process.env.HOME + '/.whaler/ssl/' + host + '.key');
        cert = fs.readFileSync(process.env.HOME + '/.whaler/ssl/' + host + '.crt');
    } catch (e) {}

    const options = {
        key: key,
        cert: cert,
        rejectUnauthorized: false
    };

    const lh = ['127.0.0.1', 'localhost', 'whaler'];
    if (-1 !== lh.indexOf(host)) {
        host = process.env.WHALER_DOCKER_IP || '172.17.0.1';
    }

    const client = tls.connect(port, host, options);

    client.on('error', (err) => {
        let message = err.message;
        if ('EPROTO' == err.code) {
            message = 'Protocol error';
        }
        console.error('');
        console.error('[%s] %s', process.pid, message);
        console.error('');

        if ('interactive' === process.env.WHALER_FRONTEND && process.stdout.isTTY) {
            process.stdin.setRawMode(false);
        }
        process.exit();
    });

    client.on('end', () => {
        if ('interactive' === process.env.WHALER_FRONTEND && process.stdout.isTTY) {
            process.stdin.setRawMode(false);
        }
        process.exit();
    });

    client.on('connect', () => {
        let timerId = null;
        if ('interactive' === process.env.WHALER_FRONTEND && process.stdout.isTTY) {
            process.stdin.setRawMode(true);
            process.stdin.pipe(client);
        }
        client.pipe(process.stdout);
        client.write(JSON.stringify({
            name: path.basename(process.cwd()),
            argv: argv,
            env: {
                FORCE_COLOR: process.env.FORCE_COLOR,
                WHALER_FRONTEND: ('interactive' === process.env.WHALER_FRONTEND && process.stdout.isTTY ? 'interactive' : 'noninteractive')
            },
            xterm: {
                cols: process.stderr.columns,
                rows: process.stdout.rows
            }
        }));
        process.stdout.on('resize', function () {
            if (timerId) {
                clearTimeout(timerId);
            }
            timerId = setTimeout(function () {
                client.write('xterm-resize:' + JSON.stringify({
                    cols: process.stderr.columns,
                    rows: process.stdout.rows
                }));
            }, 30);
        });
    });

    return client;
}
