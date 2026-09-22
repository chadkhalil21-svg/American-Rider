# The Exactness Sweep — build 20

Chad's directive (8 Aug 2026): the app must match `docs/demo-reference/traveler-institutional.html`
**exactly** — style, spacing, fonts, sizes, colors, everything. One complete build; no partial
deliveries. Verify each screen with side-by-side renders before shipping.

## The demo's master values (from its CSS — transcribe, don't approximate)

| Token | Demo value | RN translation |
|---|---|---|
| Screen padding | `58px 24px 40px` | paddingTop insets+16, H 24, bottom 40 |
| `.display` | 34px / 600 / −.02em / lh 1.14 | 34 / '600' / −0.68 / lineHeight 39 |
| `.title` | 26px (27 in this file) / 600 / −.02em | 26 / '600' / −0.52 |
| `.sub` | 14.5px muted, lh 1.5, margin-top 9 | 14.5 / lineHeight 21.75 / marginTop 9 |
| `.lbl` (section label) | 11px / 600 / .15em / uppercase / muted | 11 / '600' / 1.65 / uppercase |
| Field label | 11px / 600 / .1em / uppercase / muted | 11 / '600' / 1.1 |
| Buttons | padding 18, radius 13, 16px / 600 / .01em | ✓ radius; text 16 / '600' / 0.16 |
| Cards | white, 1px `--line #ECEBE6`, radius 16, NO shadow | ✓ |
| Field cards | padding `2px 20px`, hairline dividers | ✓ |
| Choice cards | padding 22 | check per screen |
| Wordmark | 12px / 600 / .26em; subline 7.5 / .34em | 12 / 3.12; 7.5 / 2.55 |
| Chips | radius 11, white border `--line2`, ink when on | ✓ |
| Bubbles | radius 15, max 78% | check message.tsx |
| Body letterspacing | −.005em | apply per text style where feasible |
| ETA pill / badges | radius 999 | ✓ |
| Toast | dark pill radius 12, 13.5px | check |

## Screen checklist (✓ = transcribed AND side-by-side verified)

- [x] Shared components (Screen, Title, Sub, PrimaryButton, labels + LetterheadBar, SectionLabel, Chev, Chip, toast)
- [ ] welcome / sign-in / sign-up / confirm / select account / ready
- [x] home (Begin Travel)
- [x] search (Destination)
- [x] options (Travel Options + Smart Travel promo)
- [x] prefs (Travel Preferences — built: segmented climate/atmosphere/music + chips; in flow options → prefs → confirm)
- [x] confirm (Travel Confirmation)
- [x] searching (radar)
- [x] enroute (4 phases, operator card, step bars, Safe Travels card)
- [x] communicate (chat)
- [x] complete (Travel Complete)
- [x] receipt (Travel Receipt)
- [ ] smart / smartlive / smartComplete
- [x] scheduled splash
- [x] drawer + menu (account.tsx)
- [x] profile / wallet / log / support / safety / settings / notif / refer
- [x] economics (drive.tsx vs demo economics screen — full copy check)

Removed by founders' order: the AI trip planner (everywhere).
Deliberate reals (the only allowed differences): live Apple map instead of the drawn SVG,
real dispatch/matching, real Stripe test payments, real geocoded search results, pickup pin,
walk-to-car finder, earned suggestions. Everything visual still matches the demo's system.

## THE PRE-SHIP GATE (Adrian + Chad, 10 Aug — after the drawer drift)
No build ships until a FULL-app walk — every screen against its demo twin, not just
what changed — returns an EMPTY differences list. Feature crews verify their feature;
the ship gate verifies the WHOLE app. Screens drift when later work brushes past them;
the gate exists to catch exactly that.

## MEASURE, DON'T LOOK (Chad, 11 Aug — after the drawer screenshots)

Chad sent two drawer screenshots and asked why the spacing, size and weight differed.
Reading them by eye had failed three times. The answer was to stop reading them and
measure both surfaces at the same viewport instead. Do this every time:

```bash
# both servers are already in .claude/launch.json
# demo  → http://localhost:8123/traveler-institutional.html
# app   → http://localhost:8081
```

Open both at **390 × 844**, then in each page run `getComputedStyle` +
`getBoundingClientRect` over the same elements and diff the numbers. Whole surfaces
compare in one pass, and the result is a number, not an opinion. Two cautions learned
the hard way: the demo's `#screen.fx` fade starts at `translateY(7px)`, and loading the
demo inside an iframe adds a constant offset — subtract it before comparing tops.

### What the first measured pass found (11 Aug)

The drawer was **already pixel-exact** — panel 304.2, rows 53.5 pitch, labels 15.5/400,
chevron 19px #B4B3AB, head 48px avatar + 20 padding, all identical. What actually
differed:

1. **Global tracking was missing.** The demo puts `letter-spacing:-.005em` on `<body>`,
   so every string inherits it. RN has no `em` unit, so the app shipped untracked and
   every label came out fractionally wide ("Wallet" 43.49 vs 43.02). Fixed once in
   `src/components/AppText.tsx`, which derives the point value from each style's
   fontSize. All 42 text-rendering files now import `Text` from there.
2. **`Screen` and `Drawer` decoded the demo's top padding differently.** Drawer read its
   56 as `42 status bar + 14`; Screen read its 58 as `safe area + 40`. On a Dynamic
   Island phone that put page content 26px below the drawer, where the demo puts them
   2px apart. Screen is now `Math.max(insets.top + 16, 58)` — the same convention.
3. **The type scale was not pinned.** RN defaults `allowFontScaling` to `true`, so iOS
   Dynamic Type silently resized every label. A web comparison can never reveal this.
   `AppText` now sets `allowFontScaling={false}`.

**Not fixable in code, and not a bug:** iOS Accessibility › Bold Text re-weights the
system font at OS level; no app can opt out. A phone with it on renders heavier than
the demo everywhere. The apparent size difference between the two screenshots is also
expected — the drawer is `78%` capped at `320`, so on a Pro Max the panel is 320 of a
440pt screen (73%) and on a 390pt phone it is 304 (78%). Scaled to the same width, the
contents of the wider phone's panel look ~5% smaller. That is the demo's own rule.

### DELIBERATE DEVIATION: the drawer has no spring (Chad, 12 Aug)

The demo's drawer markup ends `…drow('About American Rider') + '<div class="spring"></div>' +
drow('Sign Out')`, and `.spring{flex:1}` pins Sign Out to the bottom of the panel — a 161px
gap at 390×844. **The app deliberately omits it**, so Sign Out sits directly under the last
row with a 0px gap.

Chad has only ever viewed the demo in mobile Safari, where the URL bar and toolbar shorten
the viewport enough that the spring collapses to ~0. That tight layout is what he has been
looking at, and on 12 Aug he approved it explicitly against a screenshot: "he wanted exactly
like this where there's almost no spaces." Design authority outranks the demo's literal CSS
when the founders have seen the rendered result and chosen it.

Do NOT re-add `<View style={{ flex: 1 }} />` above the Sign Out row in `app/index.tsx`. The
operator drawer in `src/components/operator.tsx` keeps its trailing spring — nothing follows
it, so it has no visual effect.

### The typography-gate guard (12 Aug — one screen had slipped through)

`AppText` only enforces tracking and the pinned type scale on screens that actually
import from it. A re-audit on 12 Aug found `app/operator/insurance.tsx` still importing
`Text` straight from `react-native`, so its seven strings rendered untracked and would
have resized with iOS Dynamic Type. One file is enough to break the guarantee, and
nothing in the build catches it — `tsc` is perfectly happy either way.

Run this before every ship. It must print `0`:

```bash
grep -rn "from 'react-native'" app src --include='*.tsx' | grep -E '\bText\b' | grep -v 'AppText.tsx' | grep -v 'TextInput' | wc -l
```

Any file it lists is bypassing the gate: change its import to
`import { Text } from '<relative>/src/components/AppText'` and drop `Text` from the
`react-native` import. This is now part of THE PRE-SHIP GATE above.

### DESIGN PASS, 16 Aug — measured, then CORRECTED

An earlier version of this section claimed "geometry drift is real and measurable" and
named radii 10, 15, 20, 23, 28, 30 as strays. **That was wrong, and it was wrong for the
reason this whole document exists: the sanctioned set was assumed instead of measured.**

Extracting the demo's own values settles it:

  demo radii   50% · 2 · 8 · 9 · 10 · 11 · 12 · 13 · 15 · 16 · 44 · 999
  demo type    7.5 9 9.5 10 10.5 11 11.5 12 12.5 13 13.5 14 14.5 15 15.5 16 16.5 17
               18 19 20 22 23 24 26 27 28 29 30 31 32 34 36 44
  demo weights 400(3) · 500(13) · 600(128) · 700(3)

Against the real scales, 8/10/15 are the demo's own, and every remaining "stray" is a
CIRCLE — radius exactly half its element: 28→56, 30→60, 7→14, 23→46, 42→84, 20→40. A
circle's radius is correct by definition. 18 flagged files collapsed to 1 real defect.

**The one real defect was WEIGHT, not geometry**, and it is the likeliest source of the
"boldness" Chad flagged in the very first screenshot comparison. The demo sets 600 for
128 of its 147 weights; the app had NINE headings at 700 — pickup-map, +not-found,
withdraw, AuthScreen (×3), FindMiguel (×2). At 17-22px, 700 against 600 is visible.
All nine now read 600. pickup-map's title was also 21px, which is not on the demo's
scale at all; it is 20.

VERIFIED EXACT (measured, not assumed): shared components — Display 34/600/-0.68, Title
27/600/-0.54, eyebrow 11/600/+1.65, card r16 + 1px #ECEBE6, button r13 pad18, gutters 24.
Every screen inherits its chrome from these. Type scale, radii and weights across all 54
files now sit inside the demo's own sets. Zero hardcoded colours outside the theme (the
one `#000` is the switch knob's shadow, which the demo also has).

STILL NOT DONE, and not to be claimed: per-screen LAYOUT against its demo twin — section
spacing, the card padding that legitimately varies per screen (see DEMO-FINGERPRINT), and
one-off margins. Static analysis cannot see those; each screen must be rendered beside its
counterpart at 390x844. Most screens sit behind sign-in, so this needs a signed-in session
rather than a grep.
