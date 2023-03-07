#!/bin/sh

sed -i "s/MAPBOX_TOKEN/$MAPBOX_TOKEN/g" /usr/src/myapp/frontend/llmap.js
/etc/init.d/nginx start
./s2map-server/http-server 3001 &
python3 ./frontend/app.py

