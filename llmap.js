var baseurl = function(part) {
  return '/api' + part;
}

var method = 'POST';
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

/*
 * @returns {bool}
 */
inPolygonMode: function() {
  return this.$polygonMode.is(':checked');
},

/*
 * @returns {bool}
 */
inPointMode: function() {
  return this.$pointMode.is(':checked');
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

  var isReverseOrder = this.isReverseOrder();
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
  renderCell: function(cell, color, extraDesc) {
    if (!color) {
      color = "#ff0000"
    }

    var description = this.cellDescription(cell)
    if (extraDesc) {
      description += '<p>' + extraDesc;
    }

    this.$infoArea.append(description);
    this.$infoArea.append('<br/>');

    var points = _(cell.shape).map(function(ll) {
      return new L.LatLng(ll.lat, ll.lng);
    });

    var polygon = new L.Polygon(points,
      { 
        color: color,
        weight: 1,
        fill: true,
        fillOpacity: 0.2
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
    var size = 75
    _.range(0, idList.length, size).map(_.bind(function(start) {
      $.ajax({
        url: baseurl('/s2info'),
        type: method,
        dataType: 'json',
        data: {
          'id': idList.slice(start, start+size).join(',')
        },
        success: _.bind(this.renderS2Cells, this)
      });
    }, this));
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

renderPolygon: function(polygon, bounds) {
  this.resetDisplay();

  this.layerGroup.addLayer(polygon);

  this.processBounds(bounds);

  this.renderCovering(polygon.getLatLngs());
},

boundsCallback: function() {
  var bboxstr = this.$boundsInput.val() || this.placeholder;

  var regex = /[+-]?\d+\.\d+/g;
  var bboxParts = bboxstr.match(regex);

  var points = this.getPoints(bboxParts);

  var polygonPoints = []
  if (points.length == 0) {
    // try s2 parsing!
    this.idsCallback();
    return;
  }
  
  this.resetDisplay();

  if (points.length == 1) {
    var regex2 = /@(\d+)$/;
    var matches = bboxstr.match(regex2);
    if (matches) {
      this.$minLevel.val(matches[1]);
      this.$s2coveringButton.attr('checked', 'checked');
    }

    var ll = points[0];
    this.map.setView(ll, 15);
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
    iconUrl: '/img/blue-dot.png',
  })
  var markerOpts = {}
  if (!this.inPointMode()) {
  //if (this.inPolygonMode()) {
    markerOpts['icon'] = dotIcon;
  }

  if (points.length > 1) {
    var markers = _.map(points, function(p, index) {
      var marker = new L.Marker(p, markerOpts);
      marker.bindPopup('Point ' + (index  + 1) + ': ' + p.lat + ',' + p.lng);
      return marker;
    });
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
  var mqTilesAttr = 'Tiles &copy; <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png" />';
  var osmAttr = '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>';

 var stamenAttr = 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>.'

  return [
     ["Mapquest OSM", 
      new L.TileLayer(
        'http://otile{s}.mqcdn.com/tiles/1.0.0/{type}/{z}/{x}/{y}.png',
        {
          subdomains: '1234',
          type: 'osm',
        }
      ),
      mqTilesAttr
    ],
    ["Mapquest Aerial", 
      new L.TileLayer(
        'http://otile{s}.mqcdn.com/tiles/1.0.0/{type}/{z}/{x}/{y}.png',
        {
          subdomains: '1234',
          type: 'sat',
        }
      ),
      mqTilesAttr
    ],
    ["Stamen Toner Lite", new L.StamenTileLayer("toner-lite"), stamenAttr],
    ["Stamen Toner", new L.StamenTileLayer("toner"), stamenAttr],
    ["Stamen Terrain", new L.StamenTileLayer("terrain"), stamenAttr]
  ]
}(),

switchBaseMap: function(baseMapEntry) {
console.log(this.map.hasLayer(this.baseMap[1]));
  this.map.removeLayer(this.baseMap[1]);
  this.attribution.removeAttribution(this.baseMap[2]);

  this.map.addLayer(baseMapEntry[1]);
  this.attribution.addAttribution(baseMapEntry[2]);
  this.baseMap = baseMapEntry;
  this.map.invalidateSize();
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

  this.$lineMode = this.$el.find('.lineMode');
  this.$polygonMode = this.$el.find('.polygonMode');
  this.$pointMode = this.$el.find('.pointMode');

  this.$boundsButton = this.$el.find('.boundsButton');
  this.$boundsInput = this.$el.find('.boundsInput');

  this.$clearButton = this.$el.find('.clearMap');

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
    if (this.showS2Covering()) {
      this.$s2options.show();
    } else {
      this.$s2options.hide();
    }
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

  var points = window.location.hash.substring(1) ||
	  window.location.search.substring(1);
  if (!!points) {
    this.$boundsInput.val(points);
  }
  this.boundsCallback();
},

/** 
 * @param {Array.<fourSq.api.models.geo.S2Response>} cells
 * @return {Array.<L.Polygon>}
 */
renderCellsForHeatmap: function(cellColorMap, cellDescMap, cells) {
  var polygons = _(cells).filter(function(cell) { return cell.token != "X"; })
    .map(_.bind(function(c) {
      var color = cellColorMap[c.token] || cellColorMap[c.id] || cellColorMap[c.id_signed];
      if (color) { color = '#' + color; }
      var desc = cellDescMap[c.token] || cellDescMap[c.id] || cellDescMap[c.id_signed];
      return this.renderCell(c, color, desc);
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

renderHeatmapHelper: function(data) {
  var lines = data.split('\n');

  var cellColorMap = {};
  var cellDescMap = {};
  var cells = []
  _(lines).map(function(line) {
    var parts = line.split(',');
    var cell = parts[0];
    var color = parts[1];
    var desc = parts[2];
    cells.push(cell);
    cellColorMap[cell] = color;
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
    success: _.bind(this.renderCellsForHeatmap, this, cellColorMap, cellDescMap)
  });
},

renderHeatmap: function(url) {
  $.ajax({
    url: baseurl('/fetch'),
    // type: method,
    type: 'GET',
    data: {
      'url': url
    },
    success: _.bind(this.renderHeatmapHelper, this)
  });
}
});

