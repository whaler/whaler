'use strict';

const fs = require('fs');
const Docker = require('../lib/docker');

const socket = process.env.WHALER_DOCKER_SOCKET || '/var/run/docker.sock';
const stats = fs.statSync(socket);
if (!stats.isSocket()) {
    throw new Error('Are you sure the docker is running?');
}

module.exports = new Docker({
    version: process.env.WHALER_DOCKER_API || 'v1.40',
    socketPath: socket
});
