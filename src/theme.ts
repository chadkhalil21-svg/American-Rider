// American Rider — the founders' web demo, transcribed.
//
// SOURCE OF TRUTH: docs/demo-reference/traveler-institutional.html, the `:root{…}` block.
// Every value below is copied from there. If a token is not in that block it is marked
// APP-ONLY and carries the reason it exists.
//
// BLUE IS BACK (Chad, 12 Aug 2026): "we'll keep the blue as it is in the web demo."
// This retires the 8 Aug "no blue anywhere" rule. `colors.blue` now holds the demo's
// real #2E5FE0 again, which is why ~15 small surfaces (View profile ›, Travel ›,
// See all, Set default, Add a contact, tinted panels, the step bar) change colour.
export const colors = {
  // ——— demo :root, hex for hex ———
  ink: '#14171F', // --ink
  ink2: '#3A3F49', // --ink2 — emphatic secondary text
  muted: '#8A8A82', // --muted
  faint: '#B4B3AB', // --faint
  blue: '#2E5FE0', // --blue
  blueTint: '#F0F3FC', // --blue-t — tinted panel fill
  blueBorder: '#E1E9FB', // --blue-b — tinted panel border
  green: '#1F8A5B', // --green
  greenTint: '#E9F3EE', // --green-t
  red: '#B3432E', // --red
  redBorder: '#E6C4BC', // --red-b
  bg: '#F7F7F5', // --bg
  canvas: '#E7E6E1', // --canvas
  card: '#FFFFFF', // --card
  hairline: '#ECEBE6', // --line — card borders, row dividers
  border: '#E3E2DC', // --line2 — ghost buttons, chips, step bar
  fill: '#EFEEE9', // --fill — segmented control track
  solid: '#14171F', // --solid — buttons, avatars
  solidFg: '#FFFFFF', // --solid-fg

  // ——— demo, but declared inline rather than in :root ———
  disabled: '#DEDDD7', // .btn:disabled background
  disabledText: '#A9A89F', // .btn:disabled color
  mapBg: '#EEEEE9', // .map background / .finder background
  greenBorder: '#CDE6D9', // the green savings panel's border, hardcoded in the demo

  // ——— APP-ONLY ———
  inkHover: '#2A2F3D', // pressed state; the web demo uses :active opacity instead
  blueHover: '#2449B8', // pressed state for blue links
  blueSoft: 'rgba(255,255,255,0.75)', // light-on-dark secondary text (live banner)
  mapRoute: '#D8D6CC', // LiveMap's drawn route — no web equivalent (SVG built in JS)

  // Four tokens were removed on 12 Aug 2026 because the demo does not contain them and
  // every use of one put a colour on screen that the demo never shows:
  //   muted2  #6E6D65 → use `muted`  #8A8A82  (secondary text was too dark)
  //   ghost   #C9C7BC → use `faint`  #B4B3AB  (list pins were too pale)
  //   redTint #FBEFED → white card + `redBorder`, the demo's only red treatment
  //   hover   #F1F0EA → the demo presses with opacity, never a fill
  // `blueDeep` was renamed to `ink2`, its actual demo name.
} as const;

// SF Mono is the demo's --mono. React Native cannot reference the system monospace by
// that name, so IBM Plex Mono ships in the bundle as the closest grotesque mono.
// It is used ONLY where the demo writes class="mono" — seven places in the whole
// traveler app: the invite code, the search timer, the verification word, and the
// Travel Number on Confirmation / Enroute / Receipt / Travel Log.
// PRICES ARE NOT MONO. The demo sets them in the system font with tabular figures
// (class="num"); use the <Num> component for those.
export const mono = {
  regular: 'IBMPlexMono_400Regular',
  medium: 'IBMPlexMono_500Medium',
  semibold: 'IBMPlexMono_600SemiBold',
} as const;

// Demo radii: cards 16, buttons 13, chips 11, segmented track 12 / thumb 9.
export const radii = {
  card: 16,
  button: 13,
  chip: 11,
  seg: 12,
  segThumb: 9,
  pill: 999,
  small: 12,
} as const;

// The demo's cards carry a 1px hairline border and NO shadow — kept as an empty
// shadow so existing spreads stay harmless.
export const cardShadow = {} as const;

// .pad{ padding:58px 24px 40px } — the gutters are 24, not 22.
export const screenPadding = { horizontal: 24 } as const;

export const fmt = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
