#!/bin/sh

TTY=$(tty)
WHALER_PATH=${WHALER_PATH:=}
WHALER_FRONTEND=${WHALER_FRONTEND:=}
WHALER_MACHINE_NAME=${DOCKER_MACHINE_NAME:=}

case "$OSTYPE" in
    darwin*)
        # do nothing
    ;;
    *)
        WHALER_DOCKER_IP=$(/sbin/ifconfig docker0 | grep 'inet addr:' | cut -d: -f2 | awk '{ print $1}')
    ;;
esac

if [ ! -z "$WHALER_MACHINE_NAME" ]; then
    WHALER_PATH=""
    DOCKER_MACHINE_NAME=""
    eval "$(docker-machine env $WHALER_MACHINE_NAME)"
    if [ ! "$DOCKER_MACHINE_NAME" = "$WHALER_MACHINE_NAME" ]; then
        exit
    fi
    WHALER_DOCKER_IP=$(echo $DOCKER_HOST | cut -d: -f2 | cut -d/ -f3)
fi

if [ ! -z "$WHALER_PATH" ]; then
    WHALER_VOLUME="-v $WHALER_PATH:/usr/local/lib/node_modules/whaler"
fi

if [ "daemon" = "$1" ]; then

    WHALER_HELP=NO
    WHALER_PORT=1337

    idx=1
    for i in "$@"; do
    case $i in
        -h|--help)
            WHALER_HELP=YES
        ;;
        --port=*)
            WHALER_PORT="${i#*=}"
        ;;
        --port)
            WHALER_PORT=$(eval "echo \${`expr $idx + 1`}")
        ;;
    esac
    idx=`expr $idx + 1`
    done

    DOCKER_OPTS="-d --restart always"
    if [ "YES" = "$WHALER_HELP" ]; then
        DOCKER_OPTS="-it --rm"
    fi

    docker run $DOCKER_OPTS \
    -v $HOME:$HOME \
    -v $HOME/.whaler:/root/.whaler \
    -v $HOME/apps:/root/apps \
    $WHALER_VOLUME \
    -w /root/apps \
    -p $WHALER_PORT:$WHALER_PORT \
    --pid host \
    -e "WHALER_DOCKER_IP=$WHALER_DOCKER_IP" \
    -e "WHALER_DAEMON_APPS=$HOME/apps" \
    --volumes-from whaler \
    --name whaler_daemon \
    node:4.2 \
    whaler "$@"

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
