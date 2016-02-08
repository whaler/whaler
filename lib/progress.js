'use strict';

module.exports = progress;

/**
 * @param adapter
 * @returns {Object}
 */
function progress(adapter) {
    let intervalId = null;
    return {
        start: function(spaces) {
            if (!intervalId && process.stdout.isTTY) {
                intervalId = setInterval(function() {
                    process.stdout.clearLine();
                    process.stdout.cursorTo(0);
                    process.stdout.write(adapter.getMessage(spaces));
                }, adapter.getInterval());
            }
        },
        stop: function() {
            if (intervalId) {
                clearInterval(intervalId);
                process.stdout.clearLine();
                process.stdout.cursorTo(0);
                intervalId = null;
            }
        }
    };
}

/**
 * @returns {Object}
 */
progress.adapter = function() {
    let step = 0;
    const steps = ['|', '/', '—', '\\'];
    return {
        getInterval: function() {
            return 100;
        },
        getMessage: function(spaces) {
            const msg = steps[step];
            step++;
            if (steps.length == step) {
                step = 0;
            }
            return ' '.repeat(spaces || 0) + msg;
        }
    };
};
