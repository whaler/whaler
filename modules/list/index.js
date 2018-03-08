'use strict';

module.exports = exports;
module.exports.__cmd = require('./cmd');

async function exports (whaler) {

    whaler.on('list', async ctx => {
        const { default: storage } = await whaler.fetch('apps');
        const apps = await storage.all();

        const result = [];
        for (let name in apps) {
            const { env, path } = apps[name];
            const services = await whaler.emit('status', { name, app: apps[name] });
            result.push({ name, env, path, services });
        }

        ctx.result = result;
    });

}
