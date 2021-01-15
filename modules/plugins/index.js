'use strict';

const semver = require('semver');

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
        ctx.result = await plugins.install(ctx.options['name'], satisfies);
    });

    whaler.on('plugins:remove', async ctx => {
        const { default: plugins } = await whaler.fetch('plugins');
        ctx.result = await plugins.remove(ctx.options['name']);
    });

    const satisfies = async (pkg) => {
        if (pkg['engines']) {
            if (pkg['engines']['node']) {
                if (!semver.satisfies(semver.coerce(process.version), pkg['engines']['node'])) {
                    throw new Error(
                        'Package `' + pkg['name'] + '@' + pkg['version'] + '` require `node@' + pkg['engines']['node'] + '`'
                    );
                }
            }

            if (pkg['engines']['whaler']) {
                if (!semver.satisfies(semver.coerce(whaler.version), pkg['engines']['whaler'])) {
                    throw new Error(
                        'Plugin `' + pkg['name'] + '@' + pkg['version'] + '` require `whaler@' + pkg['engines']['whaler'] + '`'
                    );
                }
            }
        }
    };

}
