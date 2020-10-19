'use strict';

var fs = require('fs');
var Docker = require('../lib/docker');

var socket = process.env.WHALER_DOCKER_SOCKET || '/var/run/docker.sock';
var stats  = fs.statSync(socket);
if (!stats.isSocket()) {
    throw new Error('Are you sure the docker is running?');
}

module.exports = new Docker({
    version: process.env.WHALER_DOCKER_API || 'v1.40',
    socketPath: socket
});
