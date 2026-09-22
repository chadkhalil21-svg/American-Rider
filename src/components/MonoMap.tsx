// The map, drawn in the palette: one frame, one style, on iPhone and Android alike.
//
// WHY MAPLIBRE. Chad, 13 September 2026, on the Apple map: "restrained, high-contrast
// monochrome" — which Apple's map cannot be recoloured into (its git history records what was
// tried). MapLibre draws the style it is given (mapStyle.ts), on both stores from one
// component, so the map reads as part of the app rather than a third party's window in it.
// This supersedes the 9 September "iPhone = Apple Maps" (Chad, 13 September).
//
// CONTEXT, NOT A CONTROL. The frame swallows touches: it neither pans nor zooms nor opens
// anything, and the screen scrolls straight over it. Every ornament is off; the attribution
// OpenStreetMap's licence requires is printed beneath the frame, in words, where it can be read.
//
// NOT ON WEB. MapLibre React Native is native-only; HomeMap.web.tsx and RouteMap.web.tsx render
// nothing there, and the itinerary is stated in words either way.
import { Camera, Map, type InitialViewState } from '@maplibre/maplibre-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './AppText';
import { monoStyle } from './mapStyle';
import { useLanguage } from '../state/LanguageContext';
import { colors, radii } from '../theme';

export const MAP_ASPECT = 2.4; // wide and shallow: context under the heading, never the subject

export function MonoMap({
  view,
  frameKey,
  children,
}: {
  /** Where the camera starts: a centre and zoom, or bounds to fit. */
  view: InitialViewState;
  /** Changes when the map must re-frame (the camera is set once, at mount). */
  frameKey: string;
  children?: React.ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <View style={styles.wrap}>
      <View style={styles.frame} pointerEvents="none">
        <Map
          key={frameKey}
          style={StyleSheet.absoluteFill}
          mapStyle={monoStyle}
          dragPan={false}
          touchZoom={false}
          doubleTapZoom={false}
          doubleTapHoldZoom={false}
          touchRotate={false}
          touchPitch={false}
          logo={false}
          attribution={false}
          compass={false}
          scaleBar={false}
        >
          <Camera initialViewState={view} />
          {children}
        </Map>
      </View>
      <Text style={styles.attribution}>{t('traveler.mapAttribution')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16 },
  frame: {
    aspectRatio: MAP_ASPECT,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.fill,
    overflow: 'hidden',
  },
  attribution: { fontSize: 10.5, color: colors.muted, textAlign: 'right', marginTop: 4 },
});

export default MonoMap;
