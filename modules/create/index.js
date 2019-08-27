'use strict';

const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const mkdirp = util.promisify(require('mkdirp'));
const parseEnv = require('../../lib/parse-env');

module.exports = exports;
module.exports.__cmd = require('./cmd');

/**
 * @param whaler
 */
async function exports (whaler) {

    whaler.on('create', async ctx => {
        const whalerConfig = await whaler.config();

        let appName = ctx.options['ref'];
        let serviceName = null;

        const parts = ctx.options['ref'].split('.');
        if (2 == parts.length) {
            appName = parts[1];
            serviceName = parts[0];
        }

        const { default: docker } = await whaler.fetch('docker');
        const { default: storage } = await whaler.fetch('apps');
        const app = await storage.get(appName);

        let appConfig = app.config;
        if (ctx.options['config']) {
            appConfig = await whaler.emit('config', {
                name: appName,
                file: ctx.options['config']
            });
        }

        if (serviceName) {
            if (!appConfig['data']['services'][serviceName]) {
                throw new Error('Config for "' + ctx.options['ref'] + '" not found.');
            }
        }

        const containers = {};
        let services = Object.keys(appConfig['data']['services']);
        if (serviceName) {
            services = [serviceName];
        }

        const vars = await whaler.emit('vars', {});

        let whalerNetwork = docker.getNetwork('whaler_nw');
        try {
            await whalerNetwork.inspect();
        } catch (e) {
            whalerNetwork = await docker.createNetwork({
                'Name': 'whaler_nw',
                'CheckDuplicate': true
            });
        }

        let appNetwork = docker.getNetwork('whaler_nw.' + appName);
        try {
            await appNetwork.inspect();
        } catch (e) {
            const nwConfig = whalerConfig['network'] || {};
            appNetwork = await docker.createNetwork({
                'Name': 'whaler_nw.' + appName,
                'Driver': nwConfig['driver'] || 'bridge',
                'Options': nwConfig['options'] || {},
                'CheckDuplicate': true
            });
        }

        const keys = Object.keys(appConfig['data']['services']);
        const volumesCfg = appConfig['data']['volumes'] || {};

        for (let name of services) {
            const config = appConfig['data']['services'][name];

            whaler.info('Creating "%s.%s" container.', name, appName);

            config['env'] = config['env'] || [];
            config['env'].push('WHALER_APP=' + appName);
            config['env'].push('WHALER_SERVICE=' + name);

            if (config['env_file']) {
                if (!Array.isArray(config['env_file'])) {
                    config['env_file'] = [ config['env_file'] ];
                }

                for (let envFile of config['env_file']) {
                    try {
                        const content = await fs.readFile(envFile, 'utf8');
                        const env = parseEnv(content || '');
                        for (let key in env) {
                            vars[key] = env[key];
                        }
                    } catch (e) {}
                }
            }

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

            const index = keys.indexOf(name);
            config['labels']['whaler.position'] = JSON.stringify({
                after: keys[index - 1] || null,
                before: keys[index + 1] || null
            });

            let waitMode = 'noninteractive';
            if (config['wait']) {
                config['labels']['whaler.wait'] = config['wait'].toString();
                if ('interactive' === process.env.WHALER_WAIT_MODE) {
                    if ('interactive' === process.env.WHALER_FRONTEND && process.stdout.isTTY) {
                        waitMode = 'interactive';
                    }
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
                    'RestartPolicy': {},
                    'PortBindings': {},
                    'VolumesFrom': null,
                    'ExtraHosts': null
                }
            };

            if (config['restart']) {
                if ('string' === typeof config['restart']) {
                    config['restart'] = {
                        name: config['restart'],
                        max_retry: 0
                    };
                }
                const availableRestartPolicy = ['always', 'unless-stopped', 'on-failure'];
                createOpts['HostConfig']['RestartPolicy'] = {
                    'Name': -1 !== availableRestartPolicy.indexOf(config['restart']['name']) ? config['restart']['name'] : ''
                };
                if ('on-failure' == config['restart']['name']) {
                    createOpts['HostConfig']['RestartPolicy']['MaximumRetryCount'] = config['restart']['max_retry'] || 0;
                }
            }

            let logging = config['logging'] || whalerConfig['log'] || null;
            if (logging) {
                createOpts['HostConfig']['LogConfig'] = {
                    'Type': logging['driver'] || 'json-file',
                    'Config': logging['options'] || {}
                };
            }

            let imageId = null;
            try {
                const image = docker.getImage(createOpts['Image']);
                const info = await image.inspect();
                imageId = info['Id'];
            } catch (e) {}

            let buildContext = config['build'] || null;

            if (config['dockerfile']) {
                if (!buildContext) {
                    buildContext = [
                        { Dockerfile: config['dockerfile'] }
                    ];
                } else if ('string' === typeof buildContext) {
                    buildContext = [
                        buildContext,
                        { Dockerfile: config['dockerfile'] }
                    ];
                } else if (Array.isArray(buildContext)) {
                    buildContext.push({ Dockerfile: config['dockerfile'] });
                } else {
                    let dockerfile = 'Dockerfile';
                    if ('string' === typeof buildContext['dockerfile']) {
                        dockerfile = buildContext['dockerfile'];
                    }
                    if (!buildContext['context']) {
                        buildContext['context'] = [];
                    } else if ('string' === typeof buildContext['context']) {
                        buildContext['context'] = [ buildContext['context'] ];
                    }

                    const df = {};
                    df[dockerfile] = config['dockerfile'];
                    buildContext['context'].push(df);
                }
            }

            if (buildContext) {
                let file = null;
                let dockerfile = null;
                if ('string' === typeof buildContext) {
                    let build = buildContext;
                    if (build && !path.isAbsolute(build)) {
                        build = path.join(path.dirname(appConfig['file']), path.normalize(build));
                    }
                    file = await docker.createTarPack(build);

                } else {
                    let context = null;
                    if (Array.isArray(buildContext)) {
                        context = buildContext;

                    } else {
                        context = buildContext['context'] || null;
                        if ('string' === typeof buildContext['dockerfile']) {
                            dockerfile = buildContext['dockerfile'];
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

                    file = await docker.createTarPack({ context, dockerfile });
                }

                let pull = true;
                if ('object' === typeof config['build'] && config['build'].hasOwnProperty('pull')) {
                    pull = config['build']['pull'];
                }

                let buildargs = null;
                if ('object' === typeof config['build'] && config['build'].hasOwnProperty('args')) {
                    buildargs = {};
                    for (let arg of config['build']['args']) {
                        const arr = arg.split('=');
                        buildargs[arr[0]] = arr[1];
                    }
                    buildargs = JSON.stringify(buildargs);
                }

                let target = null;
                if ('object' === typeof config['build'] && config['build'].hasOwnProperty('target')) {
                    target = config['build']['target'];
                }

                const authconfig = await whaler.emit('create:authconfig', createOpts);
                await docker.followBuildImage(file, { pull, dockerfile, buildargs, target, authconfig, t: createOpts['Image'] });

            } else {
                try {
                    const authconfig = await whaler.emit('create:authconfig', createOpts);
                    await docker.followPull(createOpts['Image'], { authconfig });
                } catch (e) {}
            }

            const image = docker.getImage(createOpts['Image']);
            const info = await image.inspect();

            if (imageId && imageId != info['Id']) {
                try {
                    const image = docker.getImage(imageId);
                    await image.remove();
                } catch (e) {}
            }

            if (config['workdir']) {
                createOpts['WorkingDir'] = config['workdir'];
            }

            if (config['entrypoint']) {
                if (config['entrypoint'].indexOf('\n') !== -1) {
                    const dir = '/var/lib/whaler/volumes/' + appName + '/' + name;
                    const entrypoint = dir + '/entrypoint';

                    await mkdirp(dir);
                    await fs.writeFile(entrypoint, config['entrypoint'], { mode: '755' });

                    createOpts['HostConfig']['Binds'].push(entrypoint +':/usr/bin/@entrypoint');
                    config['entrypoint'] = '/usr/bin/@entrypoint';
                }
                createOpts['Entrypoint'] = config['entrypoint'];
            }

            if (config['cmd']) {
                if ('string' === typeof config['cmd']) {
                    if (config['cmd'].indexOf('\n') !== -1) {
                        const dir = '/var/lib/whaler/volumes/' + appName + '/' + name;
                        const cmd = dir + '/cmd';

                        await mkdirp(dir);
                        await fs.writeFile(cmd, config['cmd'], { mode: '755' });

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
            } else if (info['Config']['Cmd']) {
                createOpts['Cmd'] = info['Config']['Cmd'];
            }

            let volumes = [];
            if (info['ContainerConfig']['Volumes']) {
                volumes = Object.keys(info['ContainerConfig']['Volumes']);
            }

            if (config['volumes_from']) {
                let volumesFrom = [];
                for (let name of config['volumes_from']) {
                    const arr = name.split(':');
                    if ('container' === arr[0]) {
                        arr.shift();
                    } else {
                        arr[0] = arr[0] + '.' + appName;
                    }

                    // const len = arr.length;
                    // const accessLevel = arr[len - 1];
                    // if (2 == len && -1 === ['ro', 'rw', 'z', 'Z'].indexOf(accessLevel)) {
                    //     arr.pop();
                    // }

                    volumesFrom.push(arr.join(':'));

                    if (volumes.length) {
                        const container = docker.getContainer(arr[0]);
                        const info = await container.inspect();

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
                        let accessLevel = null;
                        if (3 == arr.length) {
                            accessLevel = arr.pop();
                            // if (-1 === ['ro', 'rw', 'z', 'Z'].indexOf(accessLevel)) {
                            //     accessLevel = null;
                            // }
                        }

                        if (arr[0] in volumesCfg) {
                            let volumeCfg = volumesCfg[arr[0]] || {};

                            if (volumeCfg['external']) {
                                arr[0] = volumeCfg['external']['name'] || arr[0];

                                let appVolume = docker.getVolume(arr[0]);
                                await appVolume.inspect();

                            } else {
                                if (!/^[a-z0-9-]+$/.test(arr[0])) {
                                    throw new Error('Application volume name "' + arr[0] + '" includes invalid characters, only "[a-z0-9-]" are allowed.');
                                }

                                arr[0] = 'whaler_vlm.' + appName + '.' + (volumeCfg['name'] || arr[0]);

                                volumeCfg['labels'] = volumeCfg['labels'] || {};
                                for (let l in volumeCfg['labels']) {
                                    volumeCfg['labels'][l] = JSON.stringify(volumeCfg['labels'][l]);
                                }

                                let appVolume = docker.getVolume(arr[0]);
                                try {
                                    await appVolume.inspect();
                                } catch (e) {
                                    appVolume = await docker.createVolume({
                                        'Name': arr[0],
                                        'Driver': volumeCfg['driver'] || 'local',
                                        'DriverOpts': volumeCfg['driver_opts'] || {},
                                        'Labels': volumeCfg['labels']
                                    });
                                }
                            }
                        } else {
                            if (!path.isAbsolute(arr[0])) {
                                arr[0] = path.join(path.dirname(appConfig['file']), path.normalize(arr[0]));
                            }
                        }

                        if (volumes.length) {
                            const index = volumes.indexOf(arr[1]);
                            if (-1 !== index) {
                                volumes.splice(index, 1);
                            }
                        }

                        if (accessLevel) {
                            arr.push(accessLevel);
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

            if (config['extra_hosts']) {
                createOpts['HostConfig']['ExtraHosts'] = [];
                for (let value of config['extra_hosts']) {
                    const arr = value.split(':');
                    if (3 === arr.length && 'container' === arr[1]) {
                        const container = docker.getContainer(arr[2]);
                        const info = await container.inspect();
                        createOpts['HostConfig']['ExtraHosts'].push(arr[0] + ':' + info['NetworkSettings']['Networks']['bridge']['IPAddress']);
                    } else {
                        createOpts['HostConfig']['ExtraHosts'].push(value);
                    }
                }
            }

            //const container = await docker.createContainer(createOpts);
            const container = await whaler.emit('create:container', createOpts);

            if (whalerNetwork) {
                await whalerNetwork.connect({
                    'Container': container.id
                });
            }

            if (appNetwork) {
                await appNetwork.connect({
                    'Container': container.id,
                    'EndpointConfig': {
                        'Aliases': [name]
                    }
                });
            }

            whaler.info('Container "%s.%s" created.', name, appName);

            containers[name] = container;
        }

        ctx.result = containers;
    });

    // TODO: experimental
    whaler.on('create:container', async ctx => {
        const { default: docker } = await whaler.fetch('docker');
        ctx.result = await docker.createContainer(ctx.options);
    });

    // TODO: experimental
    whaler.on('create:authconfig', async ctx => {
        try {
            const { default: config } = await whaler.import(process.env.HOME + '/.docker/config.json');

            const serveraddress = ctx.options['Image'].split('/')[0];
            if (config['auths'][serveraddress]) {
                if (config['auths'][serveraddress]['auth']) {
                    let [ username, password ] = Buffer.from(config['auths'][serveraddress]['auth'], 'base64').toString().split(':');
                    ctx.result = { username, password, serveraddress };
                }
            }
        } catch (e) {
            ctx.error = e;
        }
    });

}
