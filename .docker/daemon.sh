#!/bin/sh

set -e

: ${WHALER_PATH:=}; export WHALER_PATH

if [ ! -z "$WHALER_PATH" ]; then
    WHALER_VOLUME="-v $WHALER_PATH:/usr/local/lib/node_modules/whaler"
fi

PORT=$1
if [ -z "$PORT" ]; then
    PORT=1337
fi

docker run -d --restart always \
-v $HOME:$HOME \
-v $HOME/.whaler:/root/.whaler \
-v $HOME/apps:/root/apps \
$WHALER_VOLUME \
-w /root/apps \
-p $PORT:$PORT \
--pid host \
--volumes-from whaler \
--name whaler_daemon \
node:4.2 \
whaler daemon --port $PORT
