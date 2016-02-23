#!/bin/sh

mkdir -p /mnt/sda1/etc/whaler
mkdir -p /mnt/sda1/var/lib/whaler
ln -s /mnt/sda1/etc/whaler /etc/whaler
ln -s /mnt/sda1/var/lib/whaler /var/lib/whaler
