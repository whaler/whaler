'use strict';

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
async function exports (whaler) {

    whaler.on('plugins', async ctx => {
        const { default: plugins } = await whaler.fetch('plugins');
        ctx.result = await plugins.list();
    });

    whaler.on('plugins:install', async ctx => {
        const { default: plugins } = await whaler.fetch('plugins');
        ctx.result = await plugins.install(ctx.options['name']);
    });

    whaler.on('plugins:remove', async ctx => {
        const { default: plugins } = await whaler.fetch('plugins');
        ctx.result = await plugins.remove(ctx.options['name']);
    });

}
