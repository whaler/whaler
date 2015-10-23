'use strict';

var Q = require('q');

var addCmd = function(whaler) {
    var pkg = require('./package.json');
    var console = whaler.require('./lib/console');

    whaler.cli.command(
        pkg.name + ' [ref]'
    ).description(
        pkg.description
    ).action(function(ref, options) {

        whaler.events.emit('logs', {
            ref: ref
        }, function(err) {
            if (err) {
                return console.error('[%s] %s', process.pid, err.message, '\n');
            }
        });

    }).on('--help', function() {
        whaler.cli.argumentsHelp(this, {
            'ref': 'Container name'
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
        });
    });
};
