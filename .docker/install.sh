#!/bin/sh

DEV=NO
DAEMON=NO
VERSION=latest
ID=$(docker inspect --format '{{ .Id }}' whaler) 2>/dev/null

for i in "$@"; do
case $i in
    --version=*)
    VERSION="${i#*=}"
    shift
    ;;
    --daemon)
    DAEMON=YES
    shift
    ;;
    --dev)
    DEV=YES
    shift
    ;;
    *)
        # unknown option
    ;;
esac
done

NPM_INSTALL="npm install -g whaler@$VERSION"
if [ "YES" = "$DEV" ]; then
    NPM_INSTALL="npm install -g"
    DEV_OPTIONS="-v $HOME:$HOME -w `pwd`"
fi

if [ -z "$ID" ]; then

    echo "Installing..."

    docker run -t \
    $DEV_OPTIONS \
    -v /usr/local/bin \
    -v /usr/local/lib/node_modules \
    -v /etc/whaler:/etc/whaler \
    -v /var/lib/docker:/var/lib/docker \
    -v /var/run/docker.sock:/var/run/docker.sock \
    --name whaler \
    node:4.2 \
    $NPM_INSTALL

else

    echo "Updating..."

    docker run -t --rm \
    $DEV_OPTIONS \
    --volumes-from whaler \
    --name whaler_update_$$ \
    node:4.2 \
    $NPM_INSTALL

fi

echo ''
mkdir -p /usr/local/bin/

DAEMON_USE=''
if [ "YES" = "$DAEMON" ]; then
    curl -sSL -o /usr/local/bin/whaler-daemon https://raw.githubusercontent.com/cravler/whaler/master/.docker/daemon.sh
    if [ -f /usr/local/bin/whaler-daemon ]; then
        chmod 4755 /usr/local/bin/whaler-daemon
        DAEMON_USE='\nDaemon: $ whaler-daemon'
    fi
fi

curl -sSL -o /usr/local/bin/whaler https://raw.githubusercontent.com/cravler/whaler/master/.docker/whaler.sh
if [ -f /usr/local/bin/whaler ]; then
    chmod 4755 /usr/local/bin/whaler
    if [ -z "$ID" ]; then
        echo "Successfully installed."
    else
        echo "Successfully updated."
    fi
    echo "Use: $ whaler $DAEMON_USE"
else
    if [ -z "$ID" ]; then
        echo "Failed to install."
    else
        echo "Failed to update."
    fi
fi
echo ''
