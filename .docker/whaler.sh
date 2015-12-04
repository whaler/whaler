#!/bin/sh

TTY=$(tty)
DOCKER_IP=$(/sbin/ifconfig docker0 | grep 'inet addr:' | cut -d: -f2 | awk '{ print $1}')

set -e

: ${WHALER_PATH:=}; export WHALER_PATH
: ${WHALER_FRONTEND:=}; export WHALER_FRONTEND
: ${WHALER_DOCKER_IP:=$DOCKER_IP}; export WHALER_DOCKER_IP

if [ ! -z "$WHALER_PATH" ]; then
    WHALER_VOLUME="-v $WHALER_PATH:/usr/local/lib/node_modules/whaler"
fi

if [ "daemon" = "$1" ]; then

    WHALER_PORT=$2

    if [ "--port" = "$WHALER_PORT" ]; then
        WHALER_PORT=$3
    else
        WHALER_PORT=${2#--port=}
    fi

    if [ -z "$WHALER_PORT" ]; then
        WHALER_PORT=1337
    fi

    docker run -d --restart always \
    -v $HOME:$HOME \
    -v $HOME/.whaler:/root/.whaler \
    -v $HOME/apps:/root/apps \
    $WHALER_VOLUME \
    -w /root/apps \
    -p $WHALER_PORT:$WHALER_PORT \
    --pid host \
    -e "WHALER_DOCKER_IP=$WHALER_DOCKER_IP" \
    --volumes-from whaler \
    --name whaler_daemon \
    node:4.2 \
    whaler daemon --port $WHALER_PORT

else

    if [ -z "$WHALER_FRONTEND" ]; then
        WHALER_FRONTEND="noninteractive"
        if [ "not a tty" != "$TTY" ]; then
            WHALER_FRONTEND="interactive"
        fi
    fi

    DOCKER_OPTS="-t"
    if [ "interactive" = "$WHALER_FRONTEND" ]; then
        DOCKER_OPTS="-it"
    fi

    docker run $DOCKER_OPTS --rm \
    -v $HOME:$HOME \
    -v $HOME/.whaler:/root/.whaler \
    $WHALER_VOLUME \
    -w `pwd` \
    -e "WHALER_FRONTEND=$WHALER_FRONTEND" \
    -e "WHALER_DOCKER_IP=$WHALER_DOCKER_IP" \
    --pid host \
    --volumes-from whaler \
    --name whaler_$$ \
    node:4.2 \
    whaler "$@"

fi
