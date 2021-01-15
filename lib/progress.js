'use strict';

module.exports = progress;

/**
 * @param adapter
 * @returns {Object}
 */
function progress (adapter) {
    let intervalId = null;
    return {
        start: function (spaces) {
            if (!intervalId && process.stderr.isTTY) {
                intervalId = setInterval(function () {
                    process.stderr.clearLine();
                    process.stderr.cursorTo(0);
                    process.stderr.write(adapter.getMessage(spaces));
                }, adapter.getInterval());
            }
        },
        stop: function () {
            if (intervalId) {
                clearInterval(intervalId);
                process.stderr.clearLine();
                process.stderr.cursorTo(0);
                intervalId = null;
            }
        }
    };
}

/**
 * @returns {Object}
 */
progress.adapter = function () {
    let step = 0;
    const steps = ['|', '/', '—', '\\'];
    return {
        getInterval: function () {
            return 100;
        },
        getMessage: function (spaces) {
            const msg = steps[step];
            step++;
            if (steps.length == step) {
                step = 0;
            }
            return ' '.repeat(spaces || 0) + msg;
        }
    };
};
