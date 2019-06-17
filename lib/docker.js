'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');
const tar = require('tar-stream');
const tarFs = require('tar-fs');
const stringArgv = require('string-argv');
const dockerIgnore = require('@zeit/dockerignore');
const dockerUtil = require('dockerode/lib/util');
const BaseDocker = require('dockerode');
const getCursorPosition = require(path.dirname(__dirname) + '/lib/cursor-position');

module.exports = Docker;

function Docker() {
    if (!(this instanceof Docker)) {
        return new (Function.prototype.bind.apply(Docker, [null].concat([].slice.call(arguments))));
    }

    BaseDocker.apply(this, arguments);

    this.util = dockerUtil.extend({
        parseCmd: parseCmd,
        resizeTTY: resizeTTY,
        nameFilter: nameFilter,
        followProgress: (stream, onFinished) => {
            followProgress(this, stream, onFinished);
        }
    }, dockerUtil);
}

util.inherits(Docker, BaseDocker);

/**
 * @param opts
 * @param callback
 */
Docker.prototype.createTarPack = util.promisify(function(opts, callback) {
    callback = callback || function() {};

    const dockerfile = opts['dockerfile'] || 'Dockerfile';

    const createDockerIgnore = dir => {
        const file = path.join(dir, '.dockerignore');
        try {
            const stat = fs.statSync(file);
            if (stat.isFile()) {
                const ignore = dockerIgnore().add(
                    fs.readFileSync(file, 'utf-8').split("\n")
                );
                return function(name) {
                    ignore.filter([name]);
                    return ignore.ignores(name);
                }
            }
        } catch (err) {}
    };

    if (typeof opts === 'string') {
        const dockerignore = createDockerIgnore(opts);

        const tarStream = tarFs.pack(opts, {
            ignore: function(name) {
                if (dockerignore) {
                    const tmp = name.split(opts + '/')[1];
                    if (!['.dockerignore', dockerfile].includes(tmp)) {
                        return dockerignore(tmp);
                    }
                }
                return false;
            }
        });

        callback(null, tarStream);

    } else if (opts['context']) {
        const tarStream = tar.pack();

        if (!Array.isArray(opts['context'])) {
            opts['context'] = [opts['context']];
        }

        const addEntry = (tarStream, file) => {
            tarStream.entry(
                {
                    name: file['name'],
                    mode: file['mode']
                },
                file['content']
            );
        };

        const addDirEntry = (tarStream, dir, ignore, root = '') => {
            const files = fs.readdirSync(dir);
            for (let file of files) {
                if (!ignore(path.join(root, file))) {
                    const stat = fs.statSync(path.join(dir, file));
                    if (stat.isDirectory()) {
                        addDirEntry(tarStream, path.join(dir, file), ignore, path.join(root, file));
                    } else {
                        addEntry(tarStream, {
                            name: path.join(root, file),
                            mode: stat.mode,
                            content: fs.readFileSync(path.join(dir, file), 'utf-8')
                        });
                    }
                }
            }
        };

        for (let i = 0; i < opts['context'].length; i++) {
            if ('string' === typeof opts['context'][i]) {
                const stat = fs.statSync(opts['context'][i]);
                if (stat.isDirectory()) {
                    const dockerignore = createDockerIgnore(opts['context'][i]);
                    addDirEntry(tarStream, opts['context'][i], name => {
                        if (dockerignore) {
                            if (!['.dockerignore', dockerfile].includes(name)) {
                                return dockerignore(name);
                            }
                        }
                        return false;
                    });
                } else {
                    addEntry(tarStream, {
                        name: path.basename(opts['context'][i]),
                        mode: stat.mode,
                        content: fs.readFileSync(opts['context'][i], 'utf-8')
                    });
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
                    addEntry(tarStream, {
                        name, mode,
                        content: opts['context'][i][name]['content']
                    });
                }
            }
        }

        tarStream.finalize();

        callback(null, tarStream);

    } else {
        callback(new Error('Context must be specified!'));
    }
});

/**
 * @param image
 * @param opts
 * @param callback
 */
Docker.prototype.followPull = util.promisify(function(image, opts, callback) {
    const args = dockerUtil.processArgs(opts, callback);
    args.callback = args.callback || function() {};

    this.pull(image, args.opts, (err, stream) => {
        if (err) {
            return args.callback(err, null);
        }
        followProgress(this, stream, args.callback);
    });
});

/**
 * @param file
 * @param opts
 * @param callback
 */
Docker.prototype.followBuildImage = util.promisify(function(file, opts, callback) {
    if (typeof opts === 'string') {
        opts = { t: opts };
    }
    const args = dockerUtil.processArgs(opts, callback);
    args.callback = args.callback || function() {};

    this.buildImage(file, args.opts, (err, stream) => {
        if (err) {
            return args.callback(err, null);
        }
        followProgress(this, stream, args.callback);
    });
});

/**
 * @param str
 * @returns {Array}
 */
function parseCmd(str) {
    return stringArgv.default ? stringArgv.default(str) : stringArgv(str);
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

        if ('noninteractive' !== process.env.WHALER_FRONTEND && process.stderr.isTTY) {
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
        process.stderr.write(event.id + ': ' + event.status + ' ' + (event.progress || '') + '\n');
    } else {
        if (event.stream) {
            process.stderr.write(event.stream);
        } else {
            process.stderr.write(event.status + '\n');
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
            const size = process.stderr.getWindowSize();
            let position = status.events[event.id];
            if (status.position > size[1]) {
                position = position - (status.position - size[1]) - 1;
            }
            process.stderr.cursorTo(0, position);
            process.stderr.clearLine();
            printEvent(event);
            process.stderr.cursorTo(0, status.position);
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
    let timerId = null;
    const resizeContainer = () => {

        if (timerId) {
            clearTimeout(timerId);
        }
        timerId = setTimeout(() => {
            const dimensions = {
                h: process.stdout.rows,
                w: process.stdout.columns
            };

            if (dimensions.h != 0 && dimensions.w != 0) {
                container.resize(dimensions, () => {});
            }
        }, 30);
    };

    resizeContainer();
    process.stdout.on('resize', resizeContainer);

    return function revert() {
        process.stdout.removeListener('resize', resizeContainer);
    }
}
