'use strict';

var progress = function(adapter) {
    var intervalId = null;
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
}(function() {
    var step = 0;
    var steps = ['|', '/', '—', '\\'];
    return {
        getInterval: function() {
            return 100;
        },
        getMessage: function(spaces) {
            var msg = steps[step];
            step++;
            if (steps.length == step) {
                step = 0;
            }
            return ' '.repeat(spaces || 0) + msg;
        }
    };
}());

module.exports = progress;
