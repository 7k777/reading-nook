#!/bin/sh
set -eu
mkdir -p public
cp index.html glass.js glass.frag condensation.frag droplet.frag timeline.js timeline.frag lake.js lake.frag condensation-layout.js style.css public/
cp -R assets daynight snow timeline lake public/
