'use strict';

var Q = require('q');

var addCmd = function(whaler) {
    var pkg = require('./package.json');
    var console = whaler.require('./lib/console');

    whaler.cli.command(
        pkg.name + ' [ref]'
    ).argumentsHelp({
        'ref': 'Container name'
    }).description(
        pkg.description
    ).action(function(ref, options) {

        whaler.events.emit('logs', {
            ref: ref
        }, function(err) {
            if (err) {
                console.log('');
                return console.error('[%s] %s', process.pid, err.message, '\n');
            }
        });

    });
};

module.exports = function(whaler) {

    addCmd(whaler);

    whaler.events.on('logs', function(options, callback) {
        options['ref'] = whaler.helpers.getRef(options['ref']);

        var container = whaler.docker.getContainer(options['ref']);

        container.logs({
            follow: true,
            stdout: true,
            stderr: true
        }, function(err, stream) {
            if (err) {
                return callback(err);
            }
            stream.setEncoding('utf8');
            stream.pipe(process.stdout, { end: true });

            var exit = function() {
                process.removeListener('SIGINT', exit);
                stream.socket.end();
                process.stdout.write('\n');
                callback(null);
            };
            process.on('SIGINT', exit);
        });
    });
};
