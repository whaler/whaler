#!/bin/sh

VERSION=latest
BOOT2DOCKER=NO
WHALER_MACHINE_NAME=${DOCKER_MACHINE_NAME:=}

for i in "$@"; do
case $i in
    --version=*)
        VERSION="${i#*=}"
        shift
    ;;
    --docker-machine=*)
        WHALER_MACHINE_NAME="${i#*=}"
        shift
    ;;
    --docker-machine)
        WHALER_MACHINE_NAME="default"
        shift
    ;;
    --boot2docker)
        BOOT2DOCKER=YES
        shift
    ;;
    *)
        # unknown option
    ;;
esac
done

USE_DOCKER_MACHINE=NO
if [ ! -z "$WHALER_MACHINE_NAME" ]; then
    DOCKER_MACHINE_NAME=""
    USE_DOCKER_MACHINE=YES
    eval "$(su $SUDO_USER -c 'docker-machine env '"$WHALER_MACHINE_NAME"'')"
    if [ ! "$DOCKER_MACHINE_NAME" = "$WHALER_MACHINE_NAME" ]; then
        exit
    fi
fi

setup_sh() {
    mkdir -p /usr/local/bin/
    curl -sSL -o /usr/local/bin/whaler https://raw.githubusercontent.com/whaler/whaler/master/.docker/whaler.sh
    if [ -f /usr/local/bin/whaler ]; then
        chmod 0755 /usr/local/bin/whaler
    fi

    QUIET=NO
    if [ "YES" = "$BOOT2DOCKER" ]; then
        QUIET=YES
    fi

    if [ "NO" = "$QUIET" ]; then
        echo ''
        if [ -f /usr/local/bin/whaler ]; then
            if [ -z "$ID" ]; then
                echo "Successfully installed."
            else
                echo "Successfully updated."
            fi
            echo "Use: $ whaler"
        else
            if [ -z "$ID" ]; then
                echo "Failed to install."
            else
                echo "Failed to update."
            fi
        fi
        echo ''
    fi
}

NPM_ENV=""
NPM_INSTALL="npm install -g whaler@$VERSION"
if [ "dev" = "$VERSION" ]; then
    NPM_ENV="-e WHALER_SETUP=dev"
    NPM_INSTALL="npm install -g https://github.com/whaler/whaler.git"
fi

docker_run() {
    docker run -t --rm \
    $NPM_ENV \
    --volumes-from whaler \
    --name $1 \
    node:4.2 \
    $NPM_INSTALL

    setup_sh
}

ID=$(docker inspect --format '{{ .Id }}' whaler) 2>/dev/null

if [ -z "$ID" ]; then

    case "$USE_DOCKER_MACHINE" in
        YES)
            su $SUDO_USER -c 'docker-machine ssh '"$WHALER_MACHINE_NAME"' "curl -sSL https://raw.githubusercontent.com/whaler/whaler/master/.docker/setup.sh | sudo sh -s -- --boot2docker --version='"$VERSION"'"'
            setup_sh
        ;;
        *)
            BOOT2DOCKER_VOLUME=""
            if [ "YES" = "$BOOT2DOCKER" ]; then
                curl -sSL -o /mnt/sda1/var/lib/boot2docker/bootsync.sh https://raw.githubusercontent.com/whaler/whaler/master/.boot2docker/bootsync.sh
                chmod 0755 /mnt/sda1/var/lib/boot2docker/bootsync.sh
                /bin/sh /mnt/sda1/var/lib/boot2docker/bootsync.sh

                BOOT2DOCKER_VOLUME="-v /mnt/sda1:/mnt/sda1"
            fi

            docker create \
            -v /usr/local/bin \
            -v /usr/local/lib/node_modules \
            -v /etc/whaler:/etc/whaler \
            -v /var/lib/whaler:/var/lib/whaler \
            -v /var/lib/docker:/var/lib/docker \
            -v /var/run/docker.sock:/var/run/docker.sock \
            $BOOT2DOCKER_VOLUME \
            --name whaler \
            node:4.2

            echo "Installing..."
            docker_run whaler_install
        ;;
    esac

else

    echo "Updating..."
    docker_run whaler_update

fi
