'use strict';

var fs = require('fs');
var path = require('path');
var tar = require('tar-stream');
var tarFs = require('tar-fs');
var util = require('dockerode/lib/util');
var BaseDocker = require('dockerode');
var getCursorPosition = require(path.dirname(__dirname) + '/lib/cursor-position');

module.exports = Docker;

function Docker() {
    if (!(this instanceof Docker)) {
        return new (Function.prototype.bind.apply(Docker, [null].concat([].slice.call(arguments))));
    }

    BaseDocker.apply(this, arguments);

    this.util = util.extend({
        parseCmd: parseCmd,
        resizeTTY: resizeTTY,
        nameFilter: nameFilter,
        followProgress: (stream, onFinished) => {
            followProgress(this, stream, onFinished);
        }
    }, util);
}

require('util').inherits(Docker, BaseDocker);

/**
 * @param opts
 * @param callback
 */
Docker.prototype.createTarPack = function(opts, callback) {
    callback = callback || function() {};

    if (typeof opts === 'string') {
        const tarStream = tarFs.pack(opts);
        callback(null, tarStream);

    } else {
        if (opts['context'] || opts['dockerfile']) {
            const tarStream = tar.pack();

            if (opts['context']) {
                if (!Array.isArray(opts['context'])) {
                    opts['context'] = [opts['context']];
                }

                for (let i = 0; i < opts['context'].length; i++) {
                    if ('string' === typeof opts['context'][i]) {
                        const stat = fs.statSync(opts['context'][i]);
                        if (stat.isDirectory()) {
                            const files = fs.readdirSync(opts['context'][i]);
                            for (let file of files) {
                                const stat = fs.statSync(path.join(opts['context'][i], file));
                                tarStream.entry(
                                    {
                                        name: file,
                                        mode: stat.mode
                                    },
                                    fs.readFileSync(path.join(opts['context'][i], file), 'utf-8')
                                );
                            }
                        } else {
                            const stat = fs.statSync(opts['context'][i]);
                            tarStream.entry(
                                {
                                    name: path.basename(opts['context'][i]),
                                    mode: stat.mode
                                },
                                fs.readFileSync(opts['context'][i], 'utf-8')
                            );
                        }
                    } else {
                        for (let name in opts['context'][i]) {
                            if ('string' === typeof opts['context'][i][name]) {
                                opts['context'][i][name] = {
                                    mode: null,
                                    content: opts['context'][i][name]
                                };
                            }
                            let mode = null;
                            if (opts['context'][i][name]['mode']) {
                                mode = parseInt(opts['context'][i][name]['mode'], 8);
                            }
                            tarStream.entry(
                                {
                                    name: name,
                                    mode: mode
                                },
                                opts['context'][i][name]['content']
                            );
                        }

                    }
                }
            }

            if (opts['dockerfile']) {
                tarStream.entry({ name: 'Dockerfile' }, opts['dockerfile']);
            }
            tarStream.finalize();
            callback(null, tarStream);

        } else {
            callback(new Error('Context or Dockerfile must be specified!'));
        }
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
        followProgress(this, stream, args.callback);
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
        followProgress(this, stream, args.callback);
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
 * @param docker
 * @param stream
 * @param onFinished
 */
function followProgress(docker, stream, onFinished) {
    if ('quiet' == process.env.WHALER_DOCKER_PROGRESS) {
        docker.modem.followProgress(stream, (err, output) => {
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

        docker.modem.followProgress(stream, (err, output) => {
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

/**
 * Resize tty
 * @param container
 */
function resizeTTY(container) {
    const resizeContainer = () => {
        const dimensions = {
            h: process.stdout.rows,
            w: process.stderr.columns
        };

        if (dimensions.h != 0 && dimensions.w != 0) {
            container.resize(dimensions, () => {});
        }
    };

    resizeContainer();
    process.stdout.on('resize', resizeContainer);

    return function revert() {
        process.stdout.removeListener('resize', resizeContainer);
    }
}
