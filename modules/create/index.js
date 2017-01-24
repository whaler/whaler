'use strict';

var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
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
                file: options['config']
            });
        }

        if (serviceName) {
            if (!appConfig['data']['services'][serviceName]) {
                throw new Error('Config for "' + options['ref'] + '" not found.');
            }
        }

        const containers = {};
        let services = Object.keys(appConfig['data']['services']);
        if (serviceName) {
            services = [serviceName];
        }

        const vars = yield whaler.$emit('vars', {});

        let appNetwork = null;
        let whalerNetwork = null;
        if (docker.modem.version >= 'v1.21') {
            try {
                whalerNetwork = yield docker.createNetwork.$call(docker, {
                    'Name': 'whaler',
                    'CheckDuplicate': true
                });
            } catch (e) {
                whalerNetwork = docker.getNetwork('whaler');
            }

            try {
                appNetwork = yield docker.createNetwork.$call(docker, {
                    'Name': 'whaler:' + appName,
                    'CheckDuplicate': true
                });
            } catch (e) {
                appNetwork = docker.getNetwork('whaler:' + appName);
            }
        }

        for (let name of services) {
            const config = appConfig['data']['services'][name];

            console.info('');
            console.info('[%s] Creating "%s.%s" container.', process.pid, name, appName);

            config['env'] = config['env'] || [];
            config['env'].push('WHALER_APP=' + appName);
            config['env'].push('WHALER_SERVICE=' + name);
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

            config['labels'] = config['labels'] || {};
            for (let l in config['labels']) {
                config['labels'][l] = JSON.stringify(config['labels'][l]);
            }
            config['labels']['whaler.app'] = appName;
            config['labels']['whaler.service'] = name;

            let waitMode = 'noninteractive';
            if (config['wait']) {
                config['labels']['whaler.wait'] = config['wait'].toString();

                if (process.env.WHALER_WAIT_MODE) {
                    waitMode = process.env.WHALER_WAIT_MODE;
                } else if ('interactive' === process.env.WHALER_FRONTEND && process.stdout.isTTY) {
                    waitMode = 'interactive';
                }
            }

            let tty = false;
            let attachStdin = false;
            if ('interactive' === waitMode) {
                tty = true;
                attachStdin = true;
            }

            const createOpts = {
                'name': name + '.' + appName,
                'Hostname': name + '.' + appName,
                'Image': config['image'] || 'whaler_' + appName + '_' + name,
                'Tty': tty,
                'OpenStdin': attachStdin,
                'AttachStdin': attachStdin,
                'AttachStdout': true,
                'AttachStderr': true,
                'Env': config['env'],
                'Labels': config['labels'],
                'ExposedPorts': {},
                'HostConfig': {
                    'Binds': [
                        '/var/lib/whaler/bin/bridge:/usr/bin/@me',
                        '/var/lib/whaler/bin/bridge:/usr/bin/@whaler'
                    ],
                    'PortBindings': {},
                    'VolumesFrom': null
                }
            };

            let imageId = null;
            try {
                const image = docker.getImage(createOpts['Image']);
                const info = yield image.inspect.$call(image);
                imageId = info['Id'];
            } catch (e) {}

            if (config['dockerfile']) {
                let file = null;

                let context = config['build'] || null;
                if ('string' === typeof context && !path.isAbsolute(context)) {
                    context = path.join(path.dirname(appConfig['file']), path.normalize(context));
                } else {
                    context = null;
                }
                file = yield docker.createTarPack.$call(docker, {
                    context: context,
                    dockerfile: config['dockerfile']
                });

                const output = yield docker.followBuildImage.$call(docker, file, {
                    pull: true,
                    t: createOpts['Image']
                });

            } else if (config['build']) {
                let file = null;
                let dockerfile = null;
                if ('string' === typeof config['build']) {
                    let build = config['build'];
                    if (build && !path.isAbsolute(build)) {
                        build = path.join(path.dirname(appConfig['file']), path.normalize(build));
                    }
                    file = yield docker.createTarPack.$call(docker, build);

                } else {
                    let context = null;
                    if (Array.isArray(config['build'])) {
                        context = config['build'];

                    } else {
                        context = config['build']['context'] || null;
                        if ('string' === typeof config['build']['dockerfile']) {
                            dockerfile = config['build']['dockerfile'];
                        }
                    }

                    if (!context) {
                        throw new Error('Context must be specified!');
                    }

                    if ('string' === typeof context) {
                        if (!path.isAbsolute(context)) {
                            context = path.join(path.dirname(appConfig['file']), path.normalize(context));
                        }
                    } else if (Array.isArray(context)) {
                        for (let i = 0; i < context.length; i++) {
                            if ('string' === typeof context[i] && !path.isAbsolute(context[i])) {
                                context[i] = path.join(path.dirname(appConfig['file']), path.normalize(context[i]));
                            }
                        }
                    }

                    file = yield docker.createTarPack.$call(docker, {
                        context: context
                    });
                }

                const output = yield docker.followBuildImage.$call(docker, file, {
                    pull: true,
                    t: createOpts['Image'],
                    dockerfile: dockerfile
                });

            } else {
                try {
                    yield docker.followPull.$call(docker, createOpts['Image']);
                } catch (e) {}
            }

            const image = docker.getImage(createOpts['Image']);
            const info = yield image.inspect.$call(image);

            if (imageId && imageId != info['Id']) {
                try {
                    const image = docker.getImage(imageId);
                    yield image.remove.$call(image);
                } catch (e) {}
            }

            if (config['workdir']) {
                createOpts['WorkingDir'] = config['workdir'];
            }

            if (config['entrypoint']) {
                createOpts['Entrypoint'] = config['entrypoint'];
            }

            if (config['cmd']) {
                if ('string' === typeof config['cmd']) {
                    if (config['cmd'].indexOf('\n') !== -1) {
                        const dir = '/var/lib/whaler/volumes/' + appName + '/' + name;
                        const cmd = dir + '/cmd';

                        yield mkdirp.$call(null, dir);
                        yield fs.writeFile.$call(null, cmd, config['cmd'], { mode: '755' });

                        createOpts['HostConfig']['Binds'].push(cmd +':/usr/bin/@cmd');
                        config['cmd'] = '/usr/bin/@cmd';
                    }

                    let hasEntrypoint = !!info['Config']['Entrypoint'] && info['Config']['Entrypoint'].length;
                    if (createOpts['Entrypoint']) {
                        hasEntrypoint = !!createOpts['Entrypoint'] && createOpts['Entrypoint'].length;
                    }

                    if (hasEntrypoint) {
                        config['cmd'] = docker.util.parseCmd(config['cmd']);
                    } else {
                        config['cmd'] = ['/bin/sh', '-c', config['cmd']];
                    }
                }
                createOpts['Cmd'] = config['cmd'];
            }

            let volumes = [];
            if (info['ContainerConfig']['Volumes']) {
                volumes = Object.keys(info['ContainerConfig']['Volumes']);
            }

            if (config['volumes_from']) {
                let volumesFrom = [];
                for (let name of config['volumes_from']) {
                    let accessLevel = 'rw';
                    let containerName = null;

                    const arr = (name + ':' + accessLevel).split(':');

                    if ('container' === arr[0]) {
                        if (arr[2] !== 'ro') {
                            accessLevel = 'rw';
                        }
                        containerName = arr[1];

                    } else {
                        if (arr[1] !== 'ro') {
                            accessLevel = 'rw';
                        }
                        containerName = arr[0] + '.' + appName;
                    }

                    volumesFrom.push(containerName + ':' + accessLevel);

                    if (volumes.length) {
                        const container = docker.getContainer(containerName);
                        const info = yield container.inspect.$call(container);

                        const removeVolumes = [];
                        if (info['Mounts'] && info['Mounts'].length) {
                            for (let mount of info['Mounts']) {
                                removeVolumes.push(mount['Destination']);
                            }
                        }
                        volumes = volumes.filter((el) => {
                            return removeVolumes.indexOf(el) < 0;
                        });
                    }
                }
                createOpts['HostConfig']['VolumesFrom'] = volumesFrom;
            }

            if (config['volumes']) {
                for (let volume of config['volumes']) {
                    const arr = volume.split(':');
                    if (arr.length == 1) {
                        const index = volumes.indexOf(arr[0]);
                        if (-1 === index) {
                            volumes.push(arr[0]);
                        }
                    } else {
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

            if (whalerNetwork) {
                yield whalerNetwork.connect.$call(whalerNetwork, {
                    'Container': container.id
                });
            }

            if (appNetwork) {
                yield appNetwork.connect.$call(appNetwork, {
                    'Container': container.id,
                    'EndpointConfig': {
                        'Aliases': [name]
                    }
                });
            }

            console.info('');
            console.info('[%s] Container "%s.%s" created.', process.pid, name, appName);

            containers[name] = container;
        }

        return containers;
    });

}
