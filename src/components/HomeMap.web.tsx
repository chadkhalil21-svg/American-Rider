// The home map on web: nothing, by design. MapLibre React Native is native-only, and the
// founders ruled out Google everywhere (Chad, 9 September 2026). A home screen with no map is
// honest; one drawn by a provider we have decided not to use is not what was agreed.
import React from 'react';

export function HomeMap(_: { lat?: number | null; lng?: number | null }) {
  return null;
}

export default HomeMap;
