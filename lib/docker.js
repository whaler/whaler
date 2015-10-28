'use strict';

var fs = require('fs');
var path = require('path');
var tar = require('tar-stream');
var tarFs = require('tar-fs');
var util = require('dockerode/lib/util');
var Docker = require('dockerode');
var getCursorPosition = require(path.dirname(__dirname) + '/lib/cursor-position');

var socket = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
var stats  = fs.statSync(socket);
if (!stats.isSocket()) {
    throw new Error('Are you sure the docker is running?');
}
var docker = new Docker({
    version: 'v1.20',
    socketPath: socket
});

var printEvent = function(event) {
    if (event.id) {
        process.stdout.write(event.id + ': ' + event.status + ' ' + (event.progress || '') + '\n');
    } else {
        if (event.stream) {
            process.stdout.write(event.stream);
        } else {
            process.stdout.write(event.status + '\n');
        }
    }
};

var printEventByPosition = function(event, status) {
    if (event.id) {
        if (!status.events[event.id]) {
            status.events[event.id] = status.position;
            printEvent(event);
            status.position++;
        } else {
            var size = process.stdout.getWindowSize();
            var position = status.events[event.id];
            if (status.position > size[1]) {
                position = position - (status.position - size[1]) - 1;
            }
            process.stdout.cursorTo(0, position);
            process.stdout.clearLine();
            printEvent(event);
            process.stdout.cursorTo(0, status.position);
        }
    } else {
        printEvent(event);
        status.position++;
    }
};

var followProgress = function(stream, onFinished) {
    var next = true;
    var events = [];
    var status = false;
    var response = false;

    var intervalId = setInterval(function() {
        if (false !== status) {
            if (events.length) {
                if (next) {
                    next = false;
                    var event = events.shift();
                    if (true === status) {
                        printEvent(event);
                    } else {
                        printEventByPosition(event, status);
                    }
                    next = true;
                }

            } else if (false !== response) {
                clearInterval(intervalId);
                onFinished(response.err, response.output);
                response = false;
                process.stdout.write('\n');
            }
        }
    }, 50);

    if (process.stdout.isTTY) {
        getCursorPosition(function(err, init) {
            if (err) {
                status = true;
            } else {
                status = {
                    position: init.row,
                    events: {}
                };
            }
        });
    } else {
        status = true;
    }

    docker.modem.followProgress(stream, function(err, output) {
        response = {
            err: err,
            output: output
        };
    }, function(event) {
        events.push(event);
    });
};

module.exports = {
    util: util.extend({
        parseCmd: function(str) {
            var res = [];
            var arr = null;
            var re  = /(?:")([^"]+)(?:")|([^\s"]+)(?=\s+|$)/g;
            while (arr = re.exec(str)) {
                res.push(arr[1] ? arr[1] : arr[0]);
            }
            return res;
        }
    }, util),
    getContainer: function(id) {
        return docker.getContainer(id);
    },
    createContainer: function(opts, callback) {
        docker.createContainer(opts, callback);
    },
    listContainers: function(opts, callback) {
        var args = util.processArgs(opts, callback);
        args.callback = args.callback || function() {};

        docker.listContainers(args.opts, args.callback);
    },
    createDockerfile: function(opts, callback) {
        if (typeof opts === 'string') {
            opts = { build: opts };
        }
        var args = util.processArgs(opts, callback);
        args.callback = args.callback || function() {};

        if (opts['build']) {
            var tarStream = tarFs.pack(opts['build']);
            args.callback(null, tarStream);
        } else {
            var tarStream = tar.pack();
            tarStream.entry({ name: 'Dockerfile' }, opts['dockerfile']);
            if (opts['storage']) {
                var files = fs.readdirSync(opts['storage']);
                files.forEach(function(file) {
                    var stat = fs.statSync(path.join(opts['storage'], file));
                    tarStream.entry(
                        {
                            name: file,
                            mode: stat.mode
                        },
                        fs.readFileSync(path.join(opts['storage'], file), 'utf-8')
                    );
                });
            }
            tarStream.finalize();
            args.callback(null, tarStream);
        }
    },
    getImage: function(name) {
        return docker.getImage(name);
    },
    buildImage: function(file, opts, callback) {
        if (typeof opts === 'string') {
            opts = { t: opts };
        }
        var args = util.processArgs(opts, callback);
        args.callback = args.callback || function() {};

        docker.buildImage(file, args.opts, function(err, stream) {
            if (err) {
                return args.callback(err, null);
            }
            followProgress(stream, args.callback);
        });
    },
    pull: function(image, opts, callback) {
        var args = util.processArgs(opts, callback);
        args.callback = args.callback || function() {};

        docker.pull(image, args.opts, function(err, stream) {
            if (err) {
                return args.callback(err, null);
            }
            followProgress(stream, args.callback);
        });
    }
};