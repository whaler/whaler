#!/bin/sh

VERSION=latest
ID=$(docker inspect --format '{{ .Id }}' whaler) 2>/dev/null

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

docker_run() {
    docker run -t --rm \
    --volumes-from whaler \
    --name $1 \
    node:4.2 \
    npm install -g whaler@$VERSION
}

if [ -z "$ID" ]; then

    docker create \
    -v /usr/local/bin \
    -v /usr/local/lib/node_modules \
    -v /etc/whaler:/etc/whaler \
    -v /var/lib/whaler:/var/lib/whaler \
    -v /var/lib/docker:/var/lib/docker \
    -v /var/run/docker.sock:/var/run/docker.sock \
    --name whaler \
    node:4.2

    echo "Installing..."
    docker_run whaler_install

else

    echo "Updating..."
    docker_run whaler_update

fi

echo ''
mkdir -p /usr/local/bin/
curl -sSL -o /usr/local/bin/whaler https://raw.githubusercontent.com/cravler/whaler/master/.docker/whaler.sh
if [ -f /usr/local/bin/whaler ]; then
    chmod 4755 /usr/local/bin/whaler
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
