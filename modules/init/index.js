'use strict';

const fs = require('fs').promises;
const path = require('path');

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
async function exports (whaler) {

    whaler.on('init', async ctx => {
        ctx.options['path'] = ctx.options['path'] || process.cwd();

        if (!path.isAbsolute(ctx.options['path'])) {
            throw new Error('App path must be absolute.');
        }

        if (!/^[a-z0-9-]+$/.test(ctx.options['name'])) {
            throw new Error('Application name `' + ctx.options['name'] + '` includes invalid characters, only `[a-z0-9-]` are allowed.');
        }

        if (process.env.WHALER_DAEMON_NAME) {
            let dir = process.env.WHALER_DAEMON_DIR;

            if (dir !== ctx.options['path']) {
                dir = path.join(dir, path.basename(ctx.options['path']));
            } else {
                if (path.basename(ctx.options['path']) !== ctx.options['name']) {
                    dir = path.join(dir, ctx.options['name']);
                } else {
                    dir = path.join(dir, process.env.WHALER_DAEMON_NAME);
                }
            }

            ctx.options['path'] = dir;
            if (ctx.options['config']) {
                ctx.options['config'] = ctx.options['config'].replace(process.env.WHALER_DAEMON_DIR, dir);
            } else {
                ctx.options['config'] = path.join(dir, 'whaler.yml');
            }

            try {
                await fs.stat(dir);
            } catch (e) {
                await mkdirp(path.dirname(ctx.options['config']));
                await fs.writeFile(ctx.options['config'], '');
            }
        }

        const { default: storage } = await whaler.fetch('apps');

        const app = await storage.add(ctx.options['name'], {
            path: ctx.options['path'],
            env:  ctx.options['env'] || process.env.WHALER_ENV || 'dev',
            config: {}
        });

        try {
            app['config'] = await whaler.emit('config', {
                name: ctx.options['name'],
                file: ctx.options['config'],
                update: true
            });

            ctx.result = app;

        } catch (e) {
            await storage.remove(ctx.options['name']);
            throw e;
        }
    });

}

// PRIVATE

async function mkdirp (dir) {
    try {
        await fs.stat(dir);
        return;
    } catch (e) {}
    await fs.mkdir(dir, { recursive: true });
}
