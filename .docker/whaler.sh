#!/bin/sh

TTY=$(tty)

set -e

: ${WHALER_PATH:=}; export WHALER_PATH
: ${WHALER_FRONTEND:=}; export WHALER_FRONTEND

if [ ! -z "$WHALER_PATH" ]; then
    WHALER_VOLUME="-v $WHALER_PATH:/usr/local/lib/node_modules/whaler"
fi

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
--pid host \
--volumes-from whaler \
--name whaler_$$ \
node:4.2 \
whaler "$@"
