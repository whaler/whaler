#!/bin/sh

mkdir -p /mnt/sda1/etc/whaler
if [ ! -L /etc/whaler ]; then
    ln -s /mnt/sda1/etc/whaler /etc/whaler
fi

mkdir -p /mnt/sda1/var/lib/whaler
if [ ! -L /var/lib/whaler ]; then
    ln -s /mnt/sda1/var/lib/whaler /var/lib/whaler
fi
