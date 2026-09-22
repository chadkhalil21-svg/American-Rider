// The map's style: the locked palette, and nothing that is not in it.
//
// WHY A STYLE OF OUR OWN. Chad, 13 September 2026: the map on the home screen must be
// "restrained, high-contrast monochrome", which Apple's map cannot be (see the git history
// of HomeMap.ios.tsx). MapLibre draws whatever style it is given, so the map is drawn in the
// palette's own greys: paper for land, `fill` for parks and airfields, `border` for water,
// a three-step ramp of `border` → `faint` → `muted` for streets by importance, and labels in
// `muted` with a paper halo. No blue, no green, no brand hex that is not already in theme.ts.
//
// WHAT IS DELIBERATELY NOT DRAWN. Buildings, points of interest, transit stops, one-way
// arrows, shields, tunnels' casings — anything a directory would show. The map is context
// for a journey: land, water, streets, the names a traveler needs to place themselves.
//
// THE TILES. OpenFreeMap serves OpenMapTiles vector tiles from OpenStreetMap, with no key and
// no per-call billing, "as is" and "as available" — an interim source until the self-hosted
// tiles exist (docs/ECONOMICS-AND-INFRASTRUCTURE.md). Swapping the source is one URL here.
// OpenStreetMap's licence requires attribution; the map frame prints it beneath the map.
import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { colors } from '../theme';

export const MAP_ATTRIBUTION = '© OpenStreetMap contributors';

const name: unknown = ['coalesce', ['get', 'name:latin'], ['get', 'name']];
const byZoom = (stops: [number, number][]): unknown => [
  'interpolate',
  ['exponential', 1.4],
  ['zoom'],
  ...stops.flat(),
];

// The three street ramps, by OpenMapTiles `class`. Widths are points at the zoom given.
const STREET = {
  major: { classes: ['motorway', 'trunk', 'primary'], color: colors.muted, width: byZoom([[9, 0.8], [13, 2.2], [16, 5], [19, 12]]) },
  middle: { classes: ['secondary', 'tertiary'], color: colors.faint, width: byZoom([[11, 0.6], [13, 1.4], [16, 3.5], [19, 9]]) },
  minor: { classes: ['minor', 'service', 'residential', 'living_street', 'unclassified'], color: colors.border, width: byZoom([[13, 0.5], [15, 1.2], [17, 3], [19, 7]]) },
};

export const monoStyle: StyleSpecification = {
  version: 8,
  sources: {
    openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
  },
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': colors.bg } },
    {
      id: 'landcover',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      paint: { 'fill-color': colors.fill, 'fill-opacity': 0.7 },
    },
    {
      id: 'park',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'park',
      paint: { 'fill-color': colors.fill },
    },
    {
      id: 'aeroway',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'aeroway',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': colors.fill },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: { 'fill-color': colors.border, 'fill-antialias': true },
    },
    {
      id: 'waterway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'waterway',
      paint: { 'line-color': colors.border, 'line-width': byZoom([[10, 0.6], [16, 2]]) as never },
    },
    {
      id: 'runway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'aeroway',
      filter: ['all', ['==', ['geometry-type'], 'LineString'], ['match', ['get', 'class'], ['runway', 'taxiway'], true, false]],
      paint: { 'line-color': colors.border, 'line-width': byZoom([[11, 1], [14, 4], [17, 14]]) as never },
    },
    ...(['minor', 'middle', 'major'] as const).map((k) => ({
      id: `street-${k}`,
      type: 'line' as const,
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['==', ['geometry-type'], 'LineString'], ['match', ['get', 'class'], STREET[k].classes, true, false]] as never,
      layout: { 'line-cap': 'round' as const, 'line-join': 'round' as const },
      paint: { 'line-color': STREET[k].color, 'line-width': STREET[k].width as never },
    })),
    {
      id: 'rail',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 12,
      filter: ['all', ['==', ['geometry-type'], 'LineString'], ['match', ['get', 'class'], ['rail', 'transit'], true, false]],
      paint: { 'line-color': colors.faint, 'line-width': byZoom([[12, 0.6], [16, 1.6]]) as never, 'line-dasharray': [3, 2] },
    },
    {
      id: 'water-name',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'water_name',
      minzoom: 10,
      layout: {
        'text-field': name as never,
        'text-font': ['Noto Sans Italic'],
        'text-size': 11,
        'text-letter-spacing': 0.1,
        'symbol-placement': 'point',
      },
      paint: { 'text-color': colors.faint, 'text-halo-color': colors.bg, 'text-halo-width': 1 },
    },
    {
      id: 'street-name',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      minzoom: 15,
      filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor'], true, false],
      layout: {
        'text-field': name as never,
        'text-font': ['Noto Sans Regular'],
        'text-size': 10.5,
        'symbol-placement': 'line',
        'symbol-spacing': 400,
        'text-padding': 12,
      },
      paint: { 'text-color': colors.muted, 'text-halo-color': colors.bg, 'text-halo-width': 1.2 },
    },
    {
      id: 'place-name',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      minzoom: 9,
      filter: ['match', ['get', 'class'], ['city', 'town', 'village', 'suburb', 'neighbourhood', 'quarter'], true, false],
      layout: {
        'text-field': name as never,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['match', ['get', 'class'], 'city', 13, 'town', 12, 11] as never,
        'text-letter-spacing': 0.05,
        'text-padding': 8,
        'text-max-width': 8,
      },
      paint: { 'text-color': colors.muted, 'text-halo-color': colors.bg, 'text-halo-width': 1.2 },
    },
  ],
};
