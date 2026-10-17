#!/bin/sh
set -eu
mkdir -p public
cp index.html glass.js glass.frag condensation.frag condensation-layout.js style.css public/
cp -R assets daynight snow public/
