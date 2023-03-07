var baseurl = function(part) {
  return '/api' + part;
}

var method = 'GET';
if (window.location.host == 'localhost') {
  baseurl = function(part) {
    return 'http://localhost:9000' + part + '?callback=?';
  }
  method = 'GET';
}

var PageController = Backbone.Model.extend({
/**
 * The earth's radius in meters
 * @constant
 * @type {number}
 */
EARTH_RADIUS_M: 6371 * 1000,

/**
 * @param {number} degrees
 * @return {number}
 */
degreesToRadians: function(degrees) {
  return degrees * 0.0174532925;
},

/**
 * @param {L.LatLng} pointA
 * @param {L.LatLng} pointB
 * @return {number}
 */
distanceBetween: function(pointA, pointB) {
  var latRadA = this.degreesToRadians(pointA.lat);
  var latRadB = this.degreesToRadians(pointB.lat);
  var lngRadA = this.degreesToRadians(pointA.lng);
  var lngRadB = this.degreesToRadians(pointB.lng);

  return Math.acos(Math.sin(latRadA) * Math.sin(latRadB) +
         Math.cos(latRadA) * Math.cos(latRadB) * Math.cos(lngRadA - lngRadB)) * this.EARTH_RADIUS_M;
},

/*
 * @returns {bool}
 */
isReverseOrder: function() {
  return this.$reverseOrder.is(':checked');
},


setReverseOrder: function() {
  return this.$reverseOrder.attr("checked", "checked");
},

setNormalOrder: function() {
  return this.$normalOrder.attr("checked", "checked");
},


/*
 * @returns {bool}
 */
inPolygonMode: function() {
  return this.$polygonMode.is(':checked');
},

setPolygonMode: function() {
  return this.$polygonMode.attr('checked', 'checked');
},


/*
 * @returns {bool}
 */
inPointMode: function() {
  return this.$pointMode.is(':checked');
},

setPointMode: function() {
  return this.$pointMode.attr('checked', 'checked');
},


showS2Covering: function() {
  return this.$s2coveringButton.is(':checked')
},


shouldClear: function() {
  return this.$clearButton.is(':checked');
},

/*
 * @returns {bool}
 */
inLineMode: function() {
  return this.$lineMode.is(':checked');
},
setLineMode: function() {
  return this.$lineMode.attr('checked', 'checked');
},

/*
 * @returns {bool}
 */
inCircleMode: function() {
  return this.$circleMode.is(':checked');
},
setCircleMode: function() {
  return this.$circleMode.attr('checked', 'checked');
},

resetDisplay: function() {
  if (this.shouldClear()) {
    this.layerGroup.clearLayers();
  }
  this.$infoArea.empty();
},

addInfo: function(msg) {
  this.$infoArea.append($('<div>' + msg + '</div>'));
},

getPoints: function(tokens) {
  var points = [];
  if (!tokens) {
    return points;
  }

  if ((tokens.length % 2) != 0) {
    window.alert("extracted an odd number of number tokens, not plotting");
    return points;
  }

  this.setHash(tokens);

  var isReverseOrder = this.isReverseOrder();
  for (var i = 0; i < tokens.length; i+=2) {
    if (tokens[i] > 90) {
      isReverseOrder = true;
      this.setReverseOrder();
    }
  }

  _(_.range(0, tokens.length, 2)).each(function(i) {
    if (isReverseOrder) {
      points.push(
        new L.LatLng(tokens[i+1], tokens[i])
      );
    } else {
      points.push(
        new L.LatLng(tokens[i], tokens[i+1])
      );
    }
  });
  return points;
},

  cellDescription: function(cell) {
    return 'cell id (unsigned): ' + cell.id + '<br>' +
      'cell id (signed): ' + cell.id_signed + '<br>' +
      'cell token: ' + cell.token + '<br>' +
  //    'face: ' + cell.face + '<br>' +
      'level: ' + cell.level + '<br>' +
      'center: ' + cell.ll.lat + "," + cell.ll.lng;
  },

  /**
   * @param {fourSq.api.models.geo.S2Response} cell
   * @return {L.Polygon}
   */
  renderCell: function(cell, color, extraDesc, opacity) {
    if (!color) {
      color = "#ff0000"
    }

    opacity = opacity || 0.2;

    var description = this.cellDescription(cell)
    if (extraDesc) {
      description += '<p>' + extraDesc;
    }

    this.$infoArea.append(description);
    this.$infoArea.append('<br/>');

    var points = _(cell.shape).map(function(ll) {
      return new L.LatLng(ll.lat, ll.lng);
    });

    console.log(points);

    var polygon = new L.Polygon(points,
      {
        color: color,
        weight: 1,
        fill: true,
        fillOpacity: opacity
      });
    polygon.bindPopup(description);

    this.layerGroup.addLayer(polygon);
    return polygon;
  },

  /**
   * @param {Array.<fourSq.api.models.geo.S2Response>} cells
   * @return {Array.<L.Polygon>}
   */
  renderCells: function(cells) {
    return _(cells).filter(function(cell) { return cell.token != "X"; })
      .map(_.bind(function(c) {
        return this.renderCell(c);
      }, this));
  },

  renderS2Cells: function(cells) {
    var bounds = null;
    var polygons = this.renderCells(cells);
    _.each(polygons, function(p) {
      if (!bounds) {
        bounds = new L.LatLngBounds([p.getBounds()]);
      }
      bounds = bounds.extend(p.getBounds());
    });
    this.map.setView(bounds.getCenter());
    this.map.fitBounds(bounds);
  },

  idsCallback: function() {
    this.resetDisplay();

    var ids = this.$boundsInput.val()
      .replace(/^\s+/g, '')
      .replace(/ /g, ',')
      .replace(/\n/g, ',')
      .replace(/[^\w\s\.\-\,]|_/g, '');

    var idList = _(ids.split(',')).filter(function(id) {
      if (id == '') {
        return false;
      }
      return true;
    });
    $.ajax({
      url: baseurl('/s2info'),
      type: method,
      dataType: 'json',
      data: {
        'id': idList.join(',')
      },
      success: _.bind(this.renderS2Cells, this)
    });
  },

renderMarkers: function(points) {
  var bounds = new L.LatLngBounds(_.map(points, function(p) {
    return p.getLatLng();
  }));

  _.each(points, _.bind(function(p) {
    this.layerGroup.addLayer(p);
  }, this));

  this.processBounds(bounds);
},

processBounds: function(bounds) {
  if (!this.shouldClear() && !!this.previousBounds) {
    bounds = this.previousBounds.extend(bounds)
  }
  this.previousBounds = bounds;

  var zoom = this.map.getBoundsZoom(bounds) - 1;

  // TODO: add control offset logic?
  var centerPixel = this.map.project(bounds.getCenter(), zoom);
  var centerPoint = this.map.unproject(centerPixel, zoom)
  this.map.setView(centerPoint, zoom);
},

renderCovering: function(latlngs) {
  if (this.showS2Covering()) {
    var data = {
      'points': _(latlngs).map(function(ll) { return ll.lat + "," + ll.lng; }).join(',')
    };

    if (this.$minLevel.val()) {
      data['min_level'] = this.$minLevel.val();
    }
    if (this.$maxLevel.val()) {
      data['max_level'] = this.$maxLevel.val();
    }
    if (this.$maxCells.val()) {
      data['max_cells'] = this.$maxCells.val();
    }
    if (this.$levelMod.val()) {
      data['level_mod'] = this.$levelMod.val();
    }

    $.ajax({
        url: baseurl('/s2cover'),
        type: method,
        dataType: 'json',
        data: data,
        success: _.bind(this.renderS2Cells, this)
      });
  }
},

downloadData: function(data) {
  var downloadLink = $('<a></a>')[0];
  var json = JSON.stringify(data);
  var blob = new Blob([json], {type: "octet/stream"});
  var url = window.URL.createObjectURL(blob);
  downloadLink.href = url;
  downloadLink.download = 's2map-' + new Date() + '.geojson';
  downloadLink.click();
},

renderPolygon: function(polygon, bounds, dontClear) {
  if (!dontClear) {
    this.resetDisplay();
  }

  this.layerGroup.addLayer(polygon);

  var downloadLink = $('<a href="#">Download as GeoJSON</a>');
  polygon.bindPopup(downloadLink.click(_.bind(function() {
    this.downloadData(polygon.toGeoJSON());
  }, this))[0]);

  this.processBounds(bounds);

  if (typeof(polygon.getLatLngs) != "undefined") {
    this.renderCovering(polygon.getLatLngs());
  }
},

boundsCallback: function() {
  console.log('kill me');
  var bboxstr = this.$boundsInput.val() || this.placeholder;

  try {
    console.log('trying json parse')
    geojsonFeature = JSON.parse(bboxstr);
  } catch(e) {
   console.log(e)
   console.log('could not parse')
   geojsonFeature = null;
  }

  try {
    var wkt = new Wkt.Wkt();
    console.log(bboxstr);
    wktFeature = wkt.read(bboxstr);
  } catch(e) {
   console.log(e)
   console.log('could not parse as wkt')
   wktFeature = null;
  }


  var points = [];

  /* if (wktFeature) {
    polygon = wkt.toObject({color: 'blue'});
    console.log(polygon);
    //this.renderPolygon(polygon, polygon.getBounds())
  } else */ if (geojsonFeature) {
    console.log(geojsonFeature);
    if (geojsonFeature['type'] && geojsonFeature['coordinates']) {
      geojsonFeature = {
        'type': 'Feature',
        'properties': {},
        'geometry': geojsonFeature
      }
    }
    console.log(geojsonFeature)

    if (geojsonFeature['type'] && geojsonFeature['geometry']) {
      console.log('trying to load')
      polygon = L.geoJson(geojsonFeature);
      console.log(geojsonFeature['geometry']['coordinates'])
      console.log(_.flatten(geojsonFeature['geometry']['coordinates']))
      coords = _.flatten(geojsonFeature['geometry']['coordinates'])
      for (var i = 0; i < coords.length; i+=2) {
        points.push(new L.LatLng(coords[i+1], coords[i]));
      }
      this.setReverseOrder();
    }

    if (polygon) {
      this.renderPolygon(polygon, polygon.getBounds())
      return;
    }
  } else {
    var regex = /[+-]?\d+\.\d+/g;
    var bboxParts = bboxstr.match(regex);

    points = this.getPoints(bboxParts);
  }

  var polygonPoints = []
  if (points.length == 0) {
    // try s2 parsing!
    this.idsCallback();
    return;
  }

  this.resetDisplay();

  if (points.length == 1 && !this.inCircleMode()  ) {
    var regex2 = /@(\d+)$/;
    var matches = bboxstr.match(regex2);
    if (matches) {
      this.$minLevel.val(matches[1]);
      this.$s2coveringButton.attr('checked', 'checked');
    }

    var ll = points[0];
    // render markers will call setView again, and the map seems to hate having
    // it called twice in rapid succession
    // this.map.setView(ll, 15);
    var marker = new L.Marker(ll);
    this.renderMarkers([marker]);
    this.renderCovering([ll]);
  } else if (this.inPolygonMode()) {
    if (points.length == 2) {
       var ll1 = points[0]
       var ll2 = points[1]
       var bounds = new L.LatLngBounds(ll1, ll2);

      var ne = bounds.getNorthEast();
      var sw = bounds.getSouthWest();
      var nw = new L.LatLng(ne.lat, sw.lng);
      var se = new L.LatLng(sw.lat, ne.lng);

      polygonPoints = [nw, ne, se, sw];
    } else {
      polygonPoints = points;
    }
    var polygon = new L.Polygon(polygonPoints,
       {color: "#0000ff", weight: 1, fill: true, fillOpacity: 0.2});
    this.renderPolygon(polygon, polygon.getBounds())
  } else if (this.inCircleMode()) {
    var bounds = null;
    var radius = this.$radiusInput.val();
    _.each(points, function(point) {
      var polygon = LGeo.circle(point, radius,
         {color: "#0000ff", weight: 1, fill: true, fillOpacity: 0.2});
      this.renderPolygon(polygon, polygon.getBounds(), true);
      if (bounds == null) {
        bounds = polygon.getBounds();
      } else {
        bounds = bounds.extend(polygon.getBounds());
      }
    }, this);
    map.fitBounds(bounds);
  } else if (this.inLineMode()) {
    var polyline = new L.Polyline(points,
     {color: "#0000ff", weight: 4, fill: false, fillOpacity: 0.2});
    this.renderPolygon(polyline, polyline.getBounds());

    _.each(_.range(0, points.length - 1), _.bind(function(index) {
      var a = points[index];
      var b = points[(index+1) % points.length];
      var distance = this.distanceBetween(a, b);
      this.addInfo(a + ' --> ' + b + '<br/>--- distance: ' + distance + 'm');
    }, this))
  }

  var dotIcon = L.icon({
    iconAnchor: [5, 5],
    iconUrl: 'img/blue-dot.png',
  })
  var markerOpts = {}
  if (!this.inPointMode()) {
  //if (this.inPolygonMode()) {
    markerOpts['icon'] = dotIcon;
  }

  if (points.length > 1) {
    var markers = _.map(points, _.bind(function(p, index) {
      var marker = new L.Marker(p, markerOpts);
      var downloadLink = $('<div>Point ' + (index  + 1) + ': ' + p.lat + ',' + p.lng + '<br/><a href="#">Download all points as GeoJSON</a></div>');
      marker.bindPopup(downloadLink.click(_.bind(function() {
        this.downloadData(this.layerGroup.toGeoJSON());
      }, this))[0]);

      return marker;
    }, this));
    this.renderMarkers(markers);
  }

  // fourSq.api.services.Geo.s2cover({
  //     ne: ne.lat + ',' + ne.lng,
  //     sw: sw.lat + ',' + sw.lng
  //   },
  //   _.bind(this.renderCells, this)
  // );
},

baseMaps: function() {
  var mapboxTilesAttr = 'Tiles &copy; <a href="http://www.mapbox.com/about/maps/">Mapbox</a>, Data &copy; OSM';
  var mqTilesAttr = 'Tiles &copy; <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png" />';
  var osmAttr = '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>';

 var stamenAttr = 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>.'

  return [
     ["Mapbox Streets",
      new L.TileLayer(
        'https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
          attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a></strong>',
          tileSize: 512,
          maxZoom: 18,
          zoomOffset: -1,
          id: 'mapbox/streets-v12',
          accessToken: 'MAPBOX_TOKEN'
          }
      ),
      mapboxTilesAttr
    ],
    ["Mapbox Satellite Streets",
      new L.TileLayer(
        'https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
          attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a></strong>',
          tileSize: 512,
          maxZoom: 18,
          zoomOffset: -1,
          id: 'mapbox/satellite-streets-v11',
          accessToken: 'MAPBOX_TOKEN'
          }
      ),
      mapboxTilesAttr
    ],
    ["Stamen Toner Lite", new L.StamenTileLayer("toner-lite"), stamenAttr],
    ["Stamen Toner", new L.StamenTileLayer("toner"), stamenAttr],
    ["Stamen Terrain", new L.StamenTileLayer("terrain"), stamenAttr]
  ]
}(),

switchBaseMap: function(baseMapEntry) {
  this.map.removeLayer(this.baseMap[1]);
  this.attribution.removeAttribution(this.baseMap[2]);

  this.map.addLayer(baseMapEntry[1]);
  this.attribution.addAttribution(baseMapEntry[2]);
  this.baseMap = baseMapEntry;
  this.map.invalidateSize();
},

getMode: function() {
  return $($.find('[name=mode]:checked')[0]).attr('data-mode');
},

updateMode: function() {
  var mode = this.getMode();
  if (mode == 'circle') {
    $($.find('.circleOptions')[0]).show();
  } else {
    $($.find('.circleOptions')[0]).hide();
  }
},

updateS2CoverMode: function() {
  if (this.showS2Covering()) {
    this.$s2options.show();
  } else {
    this.$s2options.hide();
  }
},

getRadius: function() {
  return this.$radiusInput.val();
},

initialize: function() {
  this.baseMap = this.baseMaps[0];

  var opts = {
    attributionControl: false,
    zoomControl: false
  }

  this.map = new L.Map('map', opts);
  var zoom = new L.Control.Zoom()
  zoom.setPosition('topright');
  this.map.addControl(zoom);

  this.attribution = new L.Control.Attribution();
  this.attribution.addAttribution(this.baseMap[2]);
  this.attribution.addAttribution("<a href=\"http://code.google.com/p/s2-geometry-library/\">S2</a>");
  this.attribution.addAttribution("<a href=\"/README.html\">About</a>");
  this.map.addControl(this.attribution);

  this.layerGroup = new L.LayerGroup();
  this.map.addLayer(this.layerGroup);

  var basemapSelector = $('.basemapSelector');
  _.each(this.baseMaps, function (basemapEntry, index) {
    basemapSelector.append(
      $('<option></option>').attr("value", index).text(basemapEntry[0])
    )
  });
  this.map.addLayer(this.baseMap[1]);
  basemapSelector.change(_.bind(function(e) {
    this.switchBaseMap(
      this.baseMaps[parseInt(basemapSelector.find("option:selected")[0].value)]
    );
  }, this));

  this.map.on('click', _.bind(function(e) {
    if (e.originalEvent.metaKey ||
        e.originalEvent.altKey ||
        e.originalEvent.ctrlKey) {
      var popup = L.popup()
        .setLatLng(e.latlng)
        .setContent(e.latlng.lat + ',' + e.latlng.lng)
        .openOn(this.map);
    }
  }, this));

  this.$el = $(document);
  this.$infoArea = this.$el.find('.info');

  this.$reverseOrder = this.$el.find('.lnglatMode');
  this.$normalOrder = this.$el.find('.latlngMode');

  this.$lineMode = this.$el.find('.lineMode');
  this.$polygonMode = this.$el.find('.polygonMode');
  this.$pointMode = this.$el.find('.pointMode');
  this.$circleMode = this.$el.find('.circleMode');

  this.$radiusInput = this.$el.find('.radiusInput');

  this.$boundsButton = this.$el.find('.boundsButton');
  this.$boundsInput = this.$el.find('.boundsInput');

  this.$clearButton = this.$el.find('.clearMap');

  this.$modeSelect = this.$el.find('[name=mode]');
  this.$modeSelect.change(_.bind(function() {
    this.updateMode();
  }, this));

  this.$boundsButton.click(_.bind(this.boundsCallback, this));
  this.$boundsInput.keypress(/** @param {jQuery.Event} e */ _.bind(function(e) {
    // search on enter only
    if (e.which == 13) {
      // this.boundsCallback();
    }
  }, this));

  this.$s2options = this.$el.find('.s2options');
  this.$s2coveringButton = this.$el.find('.s2cover');
  this.$s2coveringButton.change(_.bind(function() {
    this.updateS2CoverMode();
  }, this));

  this.$maxCells = this.$el.find('.max_cells');
  this.$maxLevel = this.$el.find('.max_level');
  this.$minLevel = this.$el.find('.min_level');
  this.$levelMod = this.$el.find('.level_mod');

  // https://github.com/blackmad/s2map
},

initMapPage: function() {
  var placeholders = [
   '40.74,-74.0',
   '40.74,-74.0,40.75,-74.1',
   'bbox: { \n' +
   '  ne: { ' +
   '     lat: 40.74,' +
   '     lng: -74.0' +
   '   },' +
   '   sw: {' +
   '     lat: 40.75, ' +
   '     lng: -74.1 ' +
   '   }, ' +
   ' }',
  ];

  this.placeholder = _.first(_.shuffle(placeholders));
  this.$boundsInput.attr('placeholder', this.placeholder);

  this.parseHash(window.location.hash.substring(1) || window.location.search.substring(1));
  this.updateS2CoverMode();
  this.boundsCallback();
},

setHash: function(tokens) {
  var h = "";
  function addParam(k, v) {
    if (h != "") {
      h+= "&"
    }
    h += k + "=" + v;
  }

  if (this.isReverseOrder()) {
    addParam("order", "lnglat")
  } else {
    addParam("order", "latlng")
  }

  addParam("mode", this.getMode());

  if (this.getMode() == 'circle') {
    addParam("radius", this.getRadius());
  }

  if (this.showS2Covering()) {
    addParam("s2", 'true');
    addParam("s2_min_level", this.$minLevel.val());
    addParam("s2_max_level", this.$maxLevel.val());
    addParam("s2_max_cells", this.$maxCells.val());
    addParam("s2_level_mod", this.$levelMod.val());
  } else {
    addParam("s2", 'false');
  }

  addParam("points", this.$boundsInput.val());
  window.location.hash = h;
},

deparam: function (querystring) {
  // remove any preceding url and split
  querystring = querystring.substring(querystring.indexOf('?')+1).split('&');
  var params = {}, pair, d = decodeURIComponent;
  // march and parse
  for (var i = querystring.length - 1; i >= 0; i--) {
    pair = querystring[i].split('=');
    params[d(pair[0])] = d(pair[1]);
  }

  return params;
},

parseHash: function(hash) {
  if (hash.indexOf('=') == -1) {
    this.$boundsInput.val(hash);
    return;
  }

  var params = this.deparam(hash);

  if (params.order == 'lnglat') {
    this.setReverseOrder();
  } else {
    this.setNormalOrder();
  }

  if (params.mode == 'line') {
    this.setLineMode();
  } else if (params.mode == 'point') {
    this.setPointMode();
  } else if (params.mode == 'circle') {
    this.setCircleMode();
  } else {
    this.setPolygonMode();
  }

  this.updateMode();
  this.updateS2CoverMode();

  if (params.s2 == 'true') {
    this.$s2coveringButton.attr('checked', 'checked');
  }

  this.$radiusInput.val(params.radius);

  this.$maxCells.val(params.s2_max_cells);
  this.$minLevel.val(params.s2_min_level);
  this.$maxLevel.val(params.s2_max_level);
  this.$levelMod.val(params.s2_level_mod);

  this.$boundsInput.val(params.points);
},

/**
 * @param {Array.<fourSq.api.models.geo.S2Response>} cells
 * @return {Array.<L.Polygon>}
 */
renderCellsForHeatmap: function(cellColorMap, cellDescMap, cellOpacityMap, cells) {
  var polygons = _(cells).filter(function(cell) { return cell.token != "X"; })
    .map(_.bind(function(c) {
      var color = cellColorMap[c.token] || cellColorMap[c.id] || cellColorMap[c.id_signed];
      var opacity = cellOpacityMap[c.token] || cellOpacityMap[c.id] || cellOpacityMap[c.id_signed];
      if (color) { color = '#' + color; }
      var desc = cellDescMap[c.token] || cellDescMap[c.id] || cellDescMap[c.id_signed];
      return this.renderCell(c, color, desc, opacity);
    }, this));

  var bounds = null;
   _.each(polygons, function(p) {
      if (!bounds) {
        bounds = new L.LatLngBounds([p.getBounds()]);
      }
      bounds = bounds.extend(p.getBounds());
    });
    this.map.fitBounds(bounds);
},

renderHeatmapHelper: function(lines) {

  var cellColorMap = {};
  var cellOpacityMap = {};
  var cellDescMap = {};
  var cells = []
  _(lines).map(function(line) {
    var parts = line.split(',');
    var cell = parts[0];
    var color = parts[1];
    var desc = parts[2];
    var opacity = parts[3] || 0.5;
    cells.push(cell);
    cellColorMap[cell] = color;
    cellOpacityMap[cell] = opacity;
    if (desc) {
      cellDescMap[cell] = desc;
    }
  });

  $.ajax({
    url: baseurl('/s2info'),
    type: method,
    dataType: 'json',
    data: {
      'id': cells.join(',')
    },
    success: _.bind(this.renderCellsForHeatmap, this, cellColorMap, cellDescMap, cellOpacityMap)
  });
},

renderHeatmap: function(url) {
  console.log(url);
  if (url.indexOf('http') == 0) {
	  $.ajax({
	    url: baseurl('/fetch'),
	    // type: method,
	    type: 'GET',
	    data: {
	      'url': url
	    },
	    success: _.bind(function(data) {
	      var lines = data.split('\n');
              this.renderHeatmapHelper(lines);
            }, this)
	  });
  } else {
    console.log(url);
    var lines = url.split(';');
    this.renderHeatmapHelper(lines);
  }
}
});

