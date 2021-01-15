'use strict';

module.exports = parseEnv;

/**
 * @param content
 */
function parseEnv (content) {
    const env = {};

    let lines = content.split(/\r?\n|\r/).filter((line) => {
        return /\s*=\s*/i.test(line);
    }).map((line) => {
        return line.replace('export ', '');
    });

    lines.forEach((line) => {
        if (/^\s*\#/i.test(line)) {
            // ignore comment lines (starting with #)

        } else {
            const _env = line.match(/^([^=]+)\s*=\s*(.*)$/);
            const key = _env[1];
            // remove ' and " characters if right side of = is quoted
            const value = _env[2].match(/^(['"]?)([^\n]*)\1$/m)[2];

            env[key] = value;
        }
    });

    return env;
}
