#!/bin/sh

set -e

OS=linux
ARCH=amd64
VERSION=latest
DIR=/usr/local/bin
FILE=whaler

SETUP_SCRIPT=https://raw.githubusercontent.com/whaler/whaler/master/.docker/setup.sh
DOWNLOAD_BUCKET=https://github.com/whaler/whaler-client/releases/download/0.x

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

case "${OSTYPE}" in
    darwin*)
        OS=darwin
    ;;
    *)
        # other os
    ;;
esac

case "$(uname -m)" in
    aarch64|arm64)
        ARCH=arm64
    ;;
    armv7*)
        ARCH=arm7
    ;;
    armv6*)
        ARCH=arm6
    ;;
    *)
        # other os
    ;;
esac

setup_client() {
    mkdir -p ${DIR}
    curl -SL ${DOWNLOAD_BUCKET}/whaler_${OS}_${ARCH}.tar.gz | tar -xz -C ${DIR} whaler
    if [ -f ${DIR}/whaler ]; then
        chmod 0755 ${DIR}/whaler

        if [ "${DIR}/whaler" != "${DIR}/${FILE}" ]; then
            mv ${DIR}/whaler ${DIR}/${FILE}
        fi
    fi
}

setup_whaler() {
    ${DIR}/${FILE} setup --version ${1}
}

if [ ! -z "${SUDO_USER}" ]; then
    setup_client
else
    if [ -w ${DIR} ]; then
        setup_client
        setup_whaler ${VERSION}
    else
        curl -sSL ${SETUP_SCRIPT} | sudo sh -s -- --version="${VERSION}" --dir="${DIR}" --file="${FILE}"
        setup_whaler ${VERSION}
    fi
fi
