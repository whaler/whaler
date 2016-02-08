'use strict';

var fs = require('fs');
var path = require('path');
var tar = require('tar-stream');
var tarFs = require('tar-fs');
var util = require('dockerode/lib/util');
var Docker = require('dockerode');
var Modem = require('dockerode/node_modules/docker-modem/lib/modem');
var getCursorPosition = require(path.dirname(__dirname) + '/lib/cursor-position');

module.exports = Docker;

Docker.prototype.util = util.extend({
    parseCmd: parseCmd,
    nameFilter: nameFilter,
    followProgress: followProgress
}, util);

/**
 * @param opts
 * @param callback
 */
Docker.prototype.createDockerfile = function(opts, callback) {
    if (typeof opts === 'string') {
        opts = { build: opts };
    }
    const args = util.processArgs(opts, callback);
    args.callback = args.callback || function() {};

    if (opts['build']) {
        const tarStream = tarFs.pack(opts['build']);
        args.callback(null, tarStream);
    } else {
        const tarStream = tar.pack();
        tarStream.entry({ name: 'Dockerfile' }, opts['dockerfile']);
        if (opts['storage']) {
            const files = fs.readdirSync(opts['storage']);
            for (let file of files) {
                const stat = fs.statSync(path.join(opts['storage'], file));
                tarStream.entry(
                    {
                        name: file,
                        mode: stat.mode
                    },
                    fs.readFileSync(path.join(opts['storage'], file), 'utf-8')
                );
            };
        }
        tarStream.finalize();
        args.callback(null, tarStream);
    }
};

/**
 * @param image
 * @param opts
 * @param callback
 */
Docker.prototype.followPull = function(image, opts, callback) {
    const args = util.processArgs(opts, callback);
    args.callback = args.callback || function() {};

    this.pull(image, args.opts, (err, stream) => {
        if (err) {
            return args.callback(err, null);
        }
        followProgress(stream, args.callback);
    });
};

/**
 * @param file
 * @param opts
 * @param callback
 */
Docker.prototype.followBuildImage = function(file, opts, callback) {
    if (typeof opts === 'string') {
        opts = { t: opts };
    }
    const args = util.processArgs(opts, callback);
    args.callback = args.callback || function() {};

    this.buildImage(file, args.opts, (err, stream) => {
        if (err) {
            return args.callback(err, null);
        }
        followProgress(stream, args.callback);
    });
};

/**
 * @param str
 * @returns {Array}
 */
function parseCmd(str) {
    let arr;
    const res = [];
    const re  = /(?:")([^"]+)(?:")|([^\s"]+)(?=\s+|$)/g;
    while (arr = re.exec(str)) {
        res.push(arr[1] ? arr[1] : arr[0]);
    }
    return res;
}

/**
 * @param name
 * @returns {string}
 */
function nameFilter(name) {
    return '^\/[a-z0-9\-]+[\.]{1}' + name + '$';
}

/**
 * @param stream
 * @param onFinished
 */
function followProgress(stream, onFinished) {
    if ('quiet' == process.env.WHALER_DOCKER_PROGRESS) {
        Modem.prototype.followProgress(stream, (err, output) => {
            onFinished(err, output);
        });

    } else {
        let next = true;
        let status = false;
        let response = false;
        const events = [{ status: '' }];

        const intervalId = setInterval(() => {
            if (false !== status) {
                if (events.length) {
                    if (next) {
                        next = false;
                        const event = events.shift();
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
                }
            }
        }, 50);

        if ('noninteractive' !== process.env.WHALER_FRONTEND && process.stdout.isTTY) {
            getCursorPosition((err, init) => {
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

        Modem.prototype.followProgress(stream, (err, output) => {
            response = {
                err: err,
                output: output
            };
        }, (event) => {
            events.push(event);
        });
    }
}

/**
 * @param event
 */
function printEvent(event) {
    if (event.id) {
        process.stdout.write(event.id + ': ' + event.status + ' ' + (event.progress || '') + '\n');
    } else {
        if (event.stream) {
            process.stdout.write(event.stream);
        } else {
            process.stdout.write(event.status + '\n');
        }
    }
}

/**
 * @param event
 * @param status
 */
function printEventByPosition(event, status) {
    if (event.id) {
        if (!status.events[event.id]) {
            status.events[event.id] = status.position;
            printEvent(event);
            status.position++;
        } else {
            const size = process.stdout.getWindowSize();
            let position = status.events[event.id];
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
}
