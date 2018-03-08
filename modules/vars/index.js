'use strict';

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
async function exports (whaler) {

    whaler.on('vars', async ctx => {
        const { default: vars } = await whaler.fetch('vars');
        ctx.result = await vars.all();
    });

    whaler.on('vars:set', async ctx => {
        const { default: vars } = await whaler.fetch('vars');
        ctx.result =  await vars.set(ctx.options['name'], ctx.options['value']);
    });

    whaler.on('vars:unset', async ctx => {
        const { default: vars } = await whaler.fetch('vars');
        ctx.result = await vars.unset(ctx.options['name']);
    });

}
