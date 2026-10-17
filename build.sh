#!/bin/sh
set -eu
mkdir -p public
cp index.html glass.js glass.frag style.css public/
cp -R assets daynight public/
