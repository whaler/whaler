'use strict';

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
async function exports (whaler) {

    whaler.on('rebuild', async ctx => {
        await whaler.emit('remove', ctx.options);
        ctx.result = await whaler.emit('start', ctx.options);
    });

}
