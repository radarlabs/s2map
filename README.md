Overview
========
S2Map is two things
- A simple geo visualizer for when you just need to look at some points on a map quickly.
- A suite of visualizations for s2 cells and coverings. [S2](http://code.google.com/p/s2-geometry-library/) is the google quadtree/spatial curve that powers google maps, foursquare and mongodb.

When you first open the page, the default input will shuffle between a few different options. Refresh the page to see a different intial box or point. See `placeholders` in `llmap.js` for more info.

Inspiration
===========
Often I find I have one or more lat/lngs, and I want to put them on a map and not worry about formatting, writing a file, etc, so I just paste it into s2map.com (no longer available)

Running Locally
===============

Create a `.env` file and add a new variable `MAPBOX_TOKEN`. Paste the public access token found in 1password for Engineering/Mapbox.

- build: `docker build -t s2map .`
- run: `docker run -p 81:81  --env-file=.env -t s2map`
- open http://localhost:81

If you need them:
- kill: `docker kill `docker ps | egrep s2map | awk '{print $1}'``
- open shell: `docker exec -it `docker ps | egrep s2map | awk '{print $1}'` /bin/bash``

Errata
======
I'm curious if other people find this useful or have feature suggestions.

TODO
====
- See about making it 100% python for ease of not compiling C++