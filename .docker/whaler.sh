#!/bin/sh

set -e

: ${WHALER_PATH:=}; export WHALER_PATH

if [ ! -z "$WHALER_PATH" ]; then
    WHALER_VOLUME="-v $WHALER_PATH:/usr/local/lib/node_modules/whaler"
fi

docker run -it --rm \
-v $HOME:$HOME \
-v $HOME/.whaler:/root/.whaler \
$WHALER_VOLUME \
-w `pwd` \
--pid host \
--volumes-from whaler \
--name whaler_$$ \
node:4.2 \
whaler "$@"
