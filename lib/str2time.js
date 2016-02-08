'use strict';

module.exports = str2time;

/**
 * @param str
 * @returns {number}
 */
function str2time(str) {
    let result = 0;
    let number = '';
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char.match(/[0-9]/)) {
            number += char;
        } else if (char.match(/[a-z]/i) && number.length) {
            result += convert(parseInt(number), char.toLowerCase());
            number = '';
        }
    }
    return result;
}

/**
 * @param value
 * @param unit
 * @returns {number}
 */
function convert(value, unit) {
    switch(unit) {
        case 'd' : return value * 1000 * 60 * 60 * 24;
        case 'h' : return value * 1000 * 60 * 60;
        case 'm' : return value * 1000 * 60;
        case 's' : return value * 1000;
    }

    return 0;
}
