'use strict';

var addCmd = function(whaler) {
    var pkg = require('./package.json');
    var console = whaler.require('./lib/console');

    whaler.cli.command(
        pkg.name + ' [ref]'
    ).description(
        pkg.description
    ).action(function(ref, options) {

        whaler.events.emit('restart', {
            ref: ref
        }, function(err, containers) {
            if (err) {
                console.log('');
                return console.error('[%s] %s', process.pid, err.message, '\n');
            }
        });

    }).on('--help', function() {
        whaler.cli.argumentsHelp(this, {
            'ref': 'Application or container name'
        });
    });
};

module.exports = function(whaler) {

    addCmd(whaler);

    whaler.events.on('restart', function(options, callback) {
        options['ref'] = whaler.helpers.getRef(options['ref']);

        whaler.events.emit('stop', options, function(err, containers) {
            if (err) {
                return callback(err);
            }

            whaler.events.emit('start', options, function(err, containers) {
                if (err) {
                    return callback(err);
                }

                callback(null, containers);
            });
        });
    });
};
