// The typography gate. Every string in the app renders through this component so
// that two demo-exactness rules are enforced in ONE place instead of 400.
//
// 1. TRACKING. The web demo sets `letter-spacing:-.005em` on <body>, so every
//    string in it — headline, row label, price, caption — is tracked in by half a
//    hundredth of its own size, inherited. React Native has no `em` unit
//    (letterSpacing is in points), which is why the app shipped without it and
//    every label came out fractionally wider than the demo's. We derive the point
//    value from the resolved fontSize here. A style that declares its own
//    letterSpacing (the display/title/eyebrow sizes, which the demo also sets
//    explicitly) is left alone.
//
// 2. TYPE SCALE. Dynamic Type is ON, capped. This was `allowFontScaling={false}`
//    — the app pinned to the demo's exact sizes, which meant iOS Text Size did
//    nothing at all. Founders' call on 11 Aug 2026 was that exactness won;
//    reversed 5 Sept 2026 after an external review named it, and it should have
//    been reversed sooner, because it contradicted a rule the founders had
//    already written: "a non-technical or elderly person must never feel the app
//    performing at them." An app that ignores the text size somebody set for
//    themselves is performing at them — it is telling them the layout matters
//    more than their eyes.
//
//    WHY CAPPED AND NOT FREE. iOS Dynamic Type runs from xSmall to AX5, and AX5
//    is roughly 3.1x. Nothing in this app survives that: label-left/value-right
//    rows collapse, the fare and the destination land on top of each other, and a
//    money screen that overlaps its own numbers is worse for the person who needed
//    the larger text than one that stayed small.
//
//    1.3 covers the whole NON-accessibility range — xSmall through xxxLarge, which
//    is what somebody raising Settings › Display & Brightness › Text Size actually
//    gets — with the extreme AX sizes clamped. So the setting a typical older
//    traveler changes now works completely; the assistive extremes are honoured as
//    far as the layout can carry them rather than pretended at.
//
//    A caller that knows its own row can take more passes its own
//    maxFontSizeMultiplier; the spread below lets any explicit prop win.
//
//    NOT covered: iOS Accessibility › Bold Text. That re-weights the system font
//    at the OS level and no app can opt out of it. A phone with Bold Text on will
//    always render heavier than the demo. See docs/EXACTNESS-SWEEP.md.
import React from 'react';
import { StyleSheet, Text as RNText, type TextProps } from 'react-native';

const BODY_TRACKING = -0.005; // the demo's body letter-spacing, in em
const RN_DEFAULT_FONT_SIZE = 14; // what RN uses when a style omits fontSize

// The whole non-accessibility Dynamic Type range, and no further. See the note above.
export const MAX_FONT_SCALE = 1.3;

// A RAW TRANSLATION KEY REACHING THE SCREEN IS SILENT OTHERWISE.
//
// Data modules hold keys rather than sentences (VENUE_NOTES, TRAVEL_CLASSES, INSURERS,
// QUAL_DOCS) because they are built at import, before the stored language is read. That
// only works if the RENDER site calls t(). On 5 Sept 2026 one did not, and the German
// recruiting screen printed an insurer's note key to the reader. No script caught it: the
// scanner saw a key (correctly not prose) and the unused-key check saw it referenced. Every
// string in the app passes through here, so here is where it is caught.
//
// The key that actually leaked was State Farm's, named here in full until 20 Sept 2026, when
// the insurer came off the screen and the catalogues dropped the key — at which point this
// COMMENT was the only thing still naming it, and the unused-key check reported a key the code
// no longer used. A comment is not a reference. Told without the name, it survives the next
// one too.
const KEY_SHAPED = /^(traveler|operator|common|auth|legal)\.[A-Za-z0-9_]+$/;

function warnIfKey(children: React.ReactNode) {
  if (!__DEV__) return;
  if (typeof children === 'string' && KEY_SHAPED.test(children)) {
    console.error(
      `[i18n] A translation key reached the screen instead of its text: "${children}". ` +
        'The data holds keys; the render site has to call t().',
    );
  }
}

export function Text({ style, ...rest }: TextProps) {
  warnIfKey(rest.children);
  const flat = StyleSheet.flatten(style) as { fontSize?: number; letterSpacing?: number } | undefined;
  const tracked =
    flat?.letterSpacing === undefined
      ? { letterSpacing: (flat?.fontSize ?? RN_DEFAULT_FONT_SIZE) * BODY_TRACKING }
      : null;
  return (
    // Dynamic Type, capped. `rest` is spread AFTER these, so a caller that needs a
    // different ceiling — or none — still wins.
    <RNText allowFontScaling maxFontSizeMultiplier={MAX_FONT_SCALE} {...rest} style={[style, tracked]} />
  );
}
