# Whaler

This app depends on [docker](https://www.docker.com/).

![Whaler](whaler.png)

## Setup

```sh
$ curl -sSL https://git.io/get-whaler | sudo -E sh
```

OR

```sh
$ curl -sSL https://git.io/get-whaler | sudo [env] sh -s -- [options]
```

Available env vars:

```
DOCKER_MACHINE_NAME=<NAME>
```

Available options:

```
--version=<VERSION>        Specify an "Whaler" version (dev, latest, ...)).
--docker-machine=<NAME>    Setup "Whaler" inside docker-machine, env DOCKER_MACHINE_NAME will be ignored.
```

## Run app

```sh
$ whaler
```

## License

This software is under the MIT license. See the complete license in:

```
LICENSE
```
