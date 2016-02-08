'use strict';

var path = require('path');
var console = require('x-console');

module.exports = exports;
module.exports.__cmd = require('./cmd');

function exports(whaler) {

    whaler.on('create', function* (options) {
        let appName = options['ref'];
        let serviceName = null;

        const parts = options['ref'].split('.');
        if (2 == parts.length) {
            appName = parts[1];
            serviceName = parts[0];
        }

        const docker = whaler.get('docker');
        const storage = whaler.get('apps');
        const app = yield storage.get.$call(storage, appName);

        let appConfig = app.config;
        if (options['config']) {
            appConfig = yield whaler.$emit('config', {
                name: appName,
                config: options['config']
            });
        }

        if (serviceName) {
            if (!appConfig['data'][serviceName]) {
                throw new Error('Config for "' + options['ref'] + '" not found.');
            }
        }

        const containers = {};
        let services = Object.keys(appConfig['data']);
        if (serviceName) {
            services = [serviceName];
        }

        const vars = yield whaler.$emit('vars', {});

        for (let name of services) {
            const config = appConfig['data'][name];

            console.info('');
            console.info('[%s] Creating "%s.%s" container.', process.pid, name, appName);

            config['env'] = config['env'] || [];
            for (let v in vars) {
                let exists = false;
                if (config['env'].length) {
                    for (let env of config['env']) {
                        const arr = env.split('=');
                        if (-1 !== (arr[0] + '=').indexOf(v + '=')) {
                            exists = true;
                        }
                    }
                }
                if (!exists) {
                    config['env'].push(v + '=' + vars[v]);
                }
            }

            const createOpts = {
                'name': name + '.' + appName,
                'Image': null,
                'Tty': true,
                'Env': config['env'],
                'Labels': {},
                'ExposedPorts': {},
                'HostConfig': {
                    'Binds': [
                        '/var/lib/whaler/bin/bridge:/usr/bin/@me',
                        '/var/lib/whaler/bin/bridge:/usr/bin/@whaler'
                    ],
                    'PortBindings': {}
                }
            };

            if (config['image']) {
                try {
                    yield docker.followPull.$call(docker, config['image']);
                } catch (e) {}
                createOpts['Image'] = config['image'];

            } else {
                let file = null;
                if (config['build']) {
                    let build = config['build'];
                    if (build && !path.isAbsolute(build)) {
                        build = path.join(path.dirname(appConfig['file']), path.normalize(build));
                    }
                    file = yield docker.createDockerfile.$call(docker, build);

                } else {
                    let dfStorage = config['dockerfile-storage'] || null;
                    if (dfStorage && !path.isAbsolute(dfStorage)) {
                        dfStorage = path.join(path.dirname(appConfig['file']), path.normalize(dfStorage));
                    }
                    file = yield docker.createDockerfile.$call(docker, {
                        dockerfile: config['dockerfile'],
                        storage: dfStorage
                    });
                }

                const imageName = 'whaler_' + appName + '_' + name;
                const output = yield docker.followBuildImage.$call(docker, file, imageName);

                createOpts['Image'] = imageName;
            }

            let volumes = [];
            const image = docker.getImage(createOpts['Image']);
            const info = yield image.inspect.$call(image);

            if (info['ContainerConfig']['Volumes']) {
                volumes = Object.keys(info['ContainerConfig']['Volumes']);
            }

            if (config['wait']) {
                createOpts['Labels']['whaler.wait'] = config['wait'].toString();
            }

            if (config['workdir']) {
                createOpts['WorkingDir'] = config['workdir'];
            }

            if (config['entrypoint']) {
                createOpts['Entrypoint'] = config['entrypoint'];
            }

            if (config['cmd']) {
                if ('string' === typeof config['cmd']) {
                    config['cmd'] = docker.util.parseCmd(config['cmd']);
                }
                createOpts['Cmd'] = config['cmd'];
            }

            if (config['volumes']) {
                for (let volume of config['volumes']) {
                    const arr = volume.split(':');
                    if (!path.isAbsolute(arr[0])) {
                        arr[0] = path.join(path.dirname(appConfig['file']), path.normalize(arr[0]));
                    }

                    if (volumes.length) {
                        const index = volumes.indexOf(arr[1]);
                        if (-1 !== index) {
                            volumes.splice(index, 1);
                        }
                    }

                    createOpts['HostConfig']['Binds'].push(arr.join(':'));
                }
            }

            if (volumes.length) {
                for (let volume of volumes) {
                    const v = '/var/lib/whaler/volumes/' + appName + '/' + name + volume;
                    createOpts['HostConfig']['Binds'].push(v + ':' + volume);
                }
            }

            if (config['ports']) {
                for (let value of config['ports']) {
                    const arr = value.split(':');
                    let port = arr[1];
                    let hostPort = arr[0];
                    let hostIp = '';

                    if (3 === arr.length) {
                        port = arr[2];
                        hostPort = arr[1];
                        hostIp = arr[0];
                    }

                    if (-1 == port.indexOf('/tcp') || -1 == port.indexOf('/udp')) {
                        port += '/tcp';
                    }

                    createOpts['ExposedPorts'][port] = {};
                    createOpts['HostConfig']['PortBindings'][port] = [
                        {
                            'HostIp': hostIp,
                            'HostPort': hostPort
                        }
                    ];
                }
            }

            const container = yield docker.createContainer.$call(docker, createOpts);

            console.info('');
            console.info('[%s] Container "%s.%s" created.', process.pid, name, appName);

            containers[name] = container;
        }

        return containers;
    });

}
