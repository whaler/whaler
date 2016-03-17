#!/bin/sh

KITEMATIC=NO
VERSION=latest

for i in "$@"; do
case $i in
    --version=*)
        VERSION="${i#*=}"
        shift
    ;;
    --kitematic)
        KITEMATIC=YES
        shift
    ;;
    *)
        # unknown option
    ;;
esac
done

case "$OSTYPE" in
    darwin*)
        if [ -z "$DOCKER_HOST" ]; then
            eval "$(su $SUDO_USER -c 'docker-machine env default')"
        fi
    ;;
esac

setup_sh() {
    mkdir -p /usr/local/bin/
    curl -sSL -o /usr/local/bin/whaler https://raw.githubusercontent.com/whaler/whaler/master/.docker/whaler.sh
    if [ -f /usr/local/bin/whaler ]; then
        chmod 4755 /usr/local/bin/whaler
    fi
    
    if [ "NO" = "$KITEMATIC" ]; then
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

docker_run() {
    docker run -t --rm \
    --volumes-from whaler \
    --name $1 \
    node:4.2 \
    npm install -g whaler@$VERSION
    
    setup_sh
}

ID=$(docker inspect --format '{{ .Id }}' whaler) 2>/dev/null

if [ -z "$ID" ]; then

    case "$OSTYPE" in
        darwin*)
            su $SUDO_USER -c 'docker-machine ssh default "curl -sSL https://raw.githubusercontent.com/whaler/whaler/master/.docker/setup.sh | sudo sh -s -- --kitematic --version=$VERSION"'
            setup_sh
        ;;
        *)
            if [ "YES" = "$KITEMATIC" ]; then
                curl -sSL -o /mnt/sda1/var/lib/boot2docker/bootsync.sh https://raw.githubusercontent.com/whaler/whaler/master/.boot2docker/bootsync.sh
                chmod 4755 /mnt/sda1/var/lib/boot2docker/bootsync.sh
                /bin/sh /mnt/sda1/var/lib/boot2docker/bootsync.sh

                KITEMATIC_VOLUME="-v /mnt/sda1:/mnt/sda1"
            fi

            docker create \
            -v /usr/local/bin \
            -v /usr/local/lib/node_modules \
            -v /etc/whaler:/etc/whaler \
            -v /var/lib/whaler:/var/lib/whaler \
            -v /var/lib/docker:/var/lib/docker \
            -v /var/run/docker.sock:/var/run/docker.sock \
            $KITEMATIC_VOLUME \
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
