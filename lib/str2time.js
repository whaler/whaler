'use strict';

var convert = function(value, unit) {
    switch(unit) {
        case 'd' : return value * 1000 * 60 * 60 * 24;
        case 'h' : return value * 1000 * 60 * 60;
        case 'm' : return value * 1000 * 60;
        case 's' : return value * 1000;
    }
    return 0;
};

module.exports = function(str) {
    var result = 0;
    var number = '';
    for (var i = 0; i < str.length; i++) {
        var char = str[i];
        if (char.match(/[0-9]/)) {
            number += char;
        } else if (char.match(/[a-z]/i) && number.length) {
            result += convert(parseInt(number), char.toLowerCase());
            number = '';
        }
    }
    return result;
};
