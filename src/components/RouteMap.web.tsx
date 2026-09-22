// The route map on web: nothing, by design — see HomeMap.web.tsx. The itinerary card states
// the route in words either way.
import React from 'react';
import type { Coords } from '../backend/fares';
import type { Route } from '../backend/route';

export function RouteMap(_: { pickup?: Coords | null; dest?: Coords | null; route?: Route | null }) {
  return null;
}

export default RouteMap;
