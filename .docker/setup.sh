#!/bin/sh

OS=linux
VERSION=latest
DIR=/usr/local/bin
FILE=whaler

for i in "$@"; do
case $i in
    --version=*)
        VERSION="${i#*=}"
        shift
    ;;
    --dir=*)
        DIR="${i#*=}"
        shift
    ;;
    --file=*)
        FILE="${i#*=}"
        shift
    ;;
    *)
        # unknown option
    ;;
esac
done

case "$OSTYPE" in
    darwin*)
        OS=darwin
    ;;
    *)
        # other os
    ;;
esac

setup_client() {
    mkdir -p $DIR
    curl -SL -o $DIR/$FILE https://github.com/whaler/whaler-client/releases/download/$1_amd64/whaler
    if [ -f $DIR/$FILE ]; then
        chmod 0755 $DIR/$FILE
    fi
}

setup_whaler() {
    $DIR/$FILE setup --version $1
}

if [ ! -z "$SUDO_USER" ]; then
    setup_client $OS
else
    if [ -w $DIR ]; then
        setup_client $OS
        setup_whaler $VERSION
    else
        curl -sSL https://raw.githubusercontent.com/whaler/whaler/master/.docker/setup.sh | sudo sh -s -- --version="$VERSION" --dir="$DIR" --file="$FILE"
        setup_whaler $VERSION
    fi
fi