'use strict';

const Table = require('cli-table');
const utils = require('cli-table/lib/utils');

module.exports = table;

function table (options) {
    const _table = new Table(utils.options({
        head: [],
        style : {
            head: [ 'cyan' ],
            border: [ 'grey' ]
        },
        chars: {
            'middle': '|',
            'mid': '-', 'mid-mid': '+',
            'left': '|', 'left-mid': '+',
            'right': '|', 'right-mid': '+',
            'top': '-', 'top-mid': '+', 'top-left': '+', 'top-right': '+',
            'bottom': '-', 'bottom-mid': '+', 'bottom-left': '+', 'bottom-right': '+'
        }
    }, options || {}));

    /**
     * @param data
     * @returns string
     */
    _table.render = function (data) {
        if (data) {
            for (let row of data) {
                _table.push(row);
            }
        }

        return _table.toString();
    };

    return _table;
}

/**
 * @param data
 * @returns string
 */
table.render = function (data) {
    return table().render(data);
};
