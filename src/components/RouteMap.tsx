// The route on the Travel Confirmation sheet: departure, arrival and the street path between
// them, on the same map as the home screen (MonoMap.tsx), so the two read as one map on two
// screens.
//
// NO OPERATOR, NO CAR. Before dispatch there is no operator to show, so none is drawn — the
// live travel screen draws the one that is matched. NO STRAIGHT LINE. Until the server has the
// street path, only the two ends are marked; a line drawn between them would read as the route
// and is not.
import { GeoJSONSource, Layer, type LngLatBounds } from '@maplibre/maplibre-react-native';
import React from 'react';
import type { Coords } from '../backend/fares';
import type { Route } from '../backend/route';
import { MonoMap } from './MonoMap';
import { colors } from '../theme';

// Both ends, and the whole street path when there is one, inside the frame with air around.
function boundsOf(points: Coords[]): LngLatBounds {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const p of points) {
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
  }
  // Two ends on top of each other still get a frame a few hundred metres across.
  const minSpan = 0.004;
  if (east - west < minSpan) { const c = (east + west) / 2; west = c - minSpan / 2; east = c + minSpan / 2; }
  if (north - south < minSpan) { const c = (north + south) / 2; south = c - minSpan / 2; north = c + minSpan / 2; }
  return [west, south, east, north];
}

export function RouteMap({
  pickup,
  dest,
  route,
}: {
  pickup?: Coords | null;
  dest?: Coords | null;
  route?: Route | null;
}) {
  if (!pickup || !dest) return null;
  const path = route && route.coords.length >= 2 ? route.coords : null;
  const bounds = boundsOf(path ? [pickup, dest, ...path] : [pickup, dest]);
  const ends: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [pickup, dest].map((p) => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    })),
  };
  const line: GeoJSON.Feature | null = path
    ? {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: path.map((c) => [c.lng, c.lat]) },
      }
    : null;
  // The camera is set at mount; a new pair of ends, or the street path arriving, re-frames it.
  const frameKey = `${pickup.lat},${pickup.lng}>${dest.lat},${dest.lng}:${path ? path.length : 0}`;

  return (
    <MonoMap
      frameKey={frameKey}
      view={{ bounds, padding: { top: 22, right: 26, bottom: 22, left: 26 } }}
    >
      {line && (
        <GeoJSONSource id="route" data={line}>
          <Layer
            id="route-line"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': colors.ink, 'line-width': 3 }}
          />
        </GeoJSONSource>
      )}
      <GeoJSONSource id="route-ends" data={ends}>
        <Layer
          id="route-end-halo"
          type="circle"
          paint={{ 'circle-radius': 9, 'circle-color': colors.card }}
        />
        <Layer
          id="route-end-dot"
          type="circle"
          paint={{ 'circle-radius': 5.5, 'circle-color': colors.ink }}
        />
      </GeoJSONSource>
    </MonoMap>
  );
}

export default RouteMap;
