'use strict';

var addCmd = function(whaler) {
    var pkg = require('./package.json');
    var console = whaler.require('./lib/console');

    whaler.cli.command(
        pkg.name + ' [ref]'
    ).argumentsHelp({
        'ref': 'Application or container name'
    }).description(
        pkg.description
    ).action(function(ref, options) {

        whaler.events.emit('rebuild', {
            ref: ref
        }, function(err, containers) {
            if (err) {
                console.log('');
                return console.error('[%s] %s', process.pid, err.message, '\n');
            }
        });

    });
};

module.exports = function(whaler) {

    addCmd(whaler);

    whaler.events.on('rebuild', function(options, callback) {
        options['ref'] = whaler.helpers.getRef(options['ref']);

        whaler.events.emit('remove', options, function(err) {
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
