#!/bin/sh

VERSION=latest

for i in "$@"; do
case $i in
    --version=*)
        VERSION="${i#*=}"
        shift
    ;;
    *)
        # unknown option
    ;;
esac
done

setup_client() {
    mkdir -p /usr/local/bin/
    curl -SL -o /usr/local/bin/whaler https://github.com/whaler/whaler-client/releases/download/$1_amd64/whaler
    if [ -f /usr/local/bin/whaler ]; then
        chmod 0755 /usr/local/bin/whaler
    fi
}

setup_whaler() {
    /usr/local/bin/whaler setup --version $1
}

if [ ! -z "$SUDO_USER" ]; then
    setup_client linux
else
    case "$OSTYPE" in
        darwin*)
            setup_client darwin
            setup_whaler $VERSION
        ;;
        *)
            curl -sSL https://raw.githubusercontent.com/whaler/whaler/master/.docker/setup.sh | sudo sh -s -- --version="$VERSION"
            setup_whaler $VERSION
        ;;
    esac
fi
