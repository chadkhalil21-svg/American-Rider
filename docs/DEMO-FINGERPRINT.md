# Demo fingerprint — measured, not read

Every value here came from `getComputedStyle` on the live demo rendered at **390 × 844**,
captured 12 Aug 2026. The three files in `docs/demo-reference/` were diffed against
https://old-scene-d12f.adrianderksmith.workers.dev on the same day and are **byte-for-byte
identical** — the local copy is the real thing, and the demo has not changed since 8 Aug.

Use this table to check a screen without re-deriving it. If a value in the app disagrees
with a row here, the app is wrong.

## Invariant on every traveler screen

| Token | Value |
|---|---|
| Screen padding | `58px` top, `24px` sides |
| `.display` (home only) | 34px / 600 / `-0.68px` tracking / `#14171F` |
| `.title` (every other screen) | 27px / 600 / `-0.54px` tracking / `#14171F` |
| `.lbl` section eyebrow | 11px / 600 / `+1.65px` tracking / `#8A8A82`, uppercase |
| Card | radius `16px`, border `1px #ECEBE6`, background `#FFFFFF`, **no shadow** |
| Button | radius `13px`, label 16px / 600 / `+0.16px` tracking |
| Content width at 390 | `342px` (390 − 24 − 24) |

## Card padding varies by screen — do not normalise it

| Screen | Card padding (top/left) | Notes |
|---|---|---|
| home, wallet, settings, profile | `2px / 20px` | list cards — rows supply their own vertical padding |
| notifications | `4px / 20px` | |
| safe travels | `18px / 20px` | content cards |
| invite friends | `22px / 22px` | the blue-tint panel |

## Buttons are not one height

| Screen | Height | Background |
|---|---|---|
| travel log | `57px` | `#FFFFFF` (ghost) |
| safe travels | `47px` | `#2E5FE0` — **the demo's blue, on purpose** |
| invite friends | `55px` | `#14171F` (solid ink) |

## The blue-tint panel (invite friends)

| | |
|---|---|
| Background | `#F0F3FC` (`--blue-t`) |
| Border | `#E1E9FB` (`--blue-b`) |
| Eyebrow colour | `#2E5FE0` — blue, not grey |

## Known measurement offsets

- The demo's `#screen.fx` fade starts at `translateY(7px)`. **Subtract 7 from every `top`**
  in the first moment after a screen change, or wait for the animation to settle.
- Loading the demo inside an iframe adds a constant offset — measure it top-level.

## Deliberate deviations from this table

The app does not copy the demo blindly where the founders have looked at the rendered
result and chosen otherwise. Each exception is recorded in `docs/EXACTNESS-SWEEP.md`:

1. **Drawer has no spring** — Sign Out sits flush under the last row (Chad, 12 Aug).
2. **One-time welcome block on home** — the 99% story; the demo has no equivalent.
   Still awaiting a founder decision.
3. **No price on home's Recent Travel rows** — chevron instead; the row opens that trip's
   receipt (Chad + Adrian, 13 Aug). The demo prints a price here, but it prints the LIVE
   fare for re-booking that route. Ours can only know what was paid on the day, and a stale
   price on the booking screen contradicts "one all-in price, no surge, no surprises".
   **Suggested Travel keeps its price** — that one is a live quote, so it is decision-useful.
   Travel Log keeps its prices too; it is the record.
