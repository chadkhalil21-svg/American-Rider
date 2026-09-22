# Qualitative Review

The layer that lint cannot do. Every question is answered **YES · NO · UNCLEAR**, and every
answer names its evidence — a screen, a string, a measurement, a flow walked. An answer
without evidence is UNCLEAR.

**Independence.** This review is completed by someone other than the implementing agent.
An implementer may draft observations, labelled as such; they may not certify.

**For every material NO:** write one focused correction — what changes, on which screen,
and why it satisfies the contract.

**For a structural failure** (a flow, a screen's architecture, a map stage, a navigation
model): write up to three alternatives and compare them on four axes:

| Axis | Question |
|---|---|
| Comprehension | Would a first-time Traveler or Operator understand it without explanation? |
| Continuity | Does it preserve pickup, destination, route, Travel Number, Operator identity and state across the stages it touches? |
| Implementation risk | What existing behaviour could it break, and how would we know? |
| Identity | Does it read as American Rider — institutional, authoritative, sophisticated, calm — rather than as a generic app? |

Recommend one. Say why.

The acceptance question behind every item below, asked of **every screen and every string**,
not only the ones a question happens to name:
**"Is the design and language institutional, authoritative, and sophisticated?"**

---

## American Rider identity

- **Q-01** Does every screen read as the same product — same letterhead, same section-label
  voice, same card discipline — such that a screenshot of any one could not be mistaken for
  another company's app? *Evidence: five screenshots from different areas, side by side.*
- **Q-02** Would Apple, NASA, or a premium transportation operator accept this screen's level
  of detail as their own? *Evidence: name the screen and the detail that would fail.*
- **Q-03** Is "institutional" achieved through precision and restraint, not through stiffness,
  jargon, or old-fashioned government styling? *Evidence: quote a heading and a body line.*

## Visual hierarchy

- **Q-04** On each primary screen, is the primary action obvious within one second, and is
  it the only element competing at that weight? *Evidence: screen, action, competitors.*
- **Q-05** Does the type scale carry the hierarchy — title, section label, body, meta — without
  relying on boxes or color to separate levels? *Evidence: computed sizes and weights.*
- **Q-06** Does anything on the screen look visually awkward — misaligned, crowded, orphaned,
  or unexplained? *Evidence: the element and a measurement.*

## Intentional whitespace

- **Q-07** Is empty space composed — balancing a lockup, separating groups — rather than left
  over? *Evidence: the front door's spring balance; any screen where space pools at one end.*
- **Q-08** Does spacing come from a system (consistent gaps, margins, card padding) rather
  than per-element adjustments? *Evidence: measured gaps across three screens.*

## Unnecessary containers

- **Q-09** For every card, panel, or bordered box: can the reviewer say what containment it
  provides that whitespace could not? *Evidence: list the containers that cannot be justified.*
- **Q-10** Are there components that exist to fill empty space rather than to inform or
  enable an action? *Evidence: name them.*
- **Q-11** Is any decorative element present without a functional reason — an icon that
  labels nothing, a divider that separates nothing? *Evidence: name them.*

## Natural language

- **Q-12** Would a non-technical or elderly Traveler read every sentence on this screen as
  plain English, with nothing performed at them? *Evidence: quote the weakest sentence.*
- **Q-13** Does any string reassure, editorialize, apologize, chat, or sell? *Evidence: quote it.*
- **Q-14** Is every control named after the action it immediately performs, and every visible
  number labelled with what it is? *Evidence: the control or number that fails.*
- **Q-15** Where precision exists, is it used — full place names, exact amounts, exact times —
  instead of conversational shorthand? *Evidence: quote.*

## Translation tone

- **Q-16** In each language, does the register match the product — formal address (usted,
  vous, Lei, Sie), institutional but plain — rather than a literal or casual rendering?
  *Evidence: a native reader's judgment on ≥20 strings per language.*
- **Q-17** Do translated strings fit their layout — no truncation, no wrapping that breaks
  meaning, no orphaned separators — at 320pt? *Evidence: screenshots in the longest language.*
- **Q-18** Do the translations preserve the exact meaning of money, safety, and legal
  statements, with English stated as governing where required? *Evidence: side-by-side.*

## Traveler versus Operator voice

- **Q-19** Do Traveler screens speak plain human English and Operator screens ARTS
  terminology, with no leakage either way? *Evidence: quote one crossing.*
- **Q-20** Does the Operator side read as a professional instrument — precise, operational,
  respectful of someone who does this for a living? *Evidence: the offer and revenue screens.*

## Flow continuity

- **Q-21** From the front door to a confirmed travel, does each screen answer: where did I
  come from, what am I doing, what is the one action, what happens next? *Evidence: walk it
  and name the screen where any answer is missing.*
- **Q-22** Are there several screens that should become one interaction, or one overloaded
  screen that should become steps? *Evidence: name them and say why.*
- **Q-23** What happens on failure, while loading, when there is no data, and when the user
  changes their mind — and is each state designed, not defaulted? *Evidence: the state that
  is missing or looks unfinished.*
- **Q-24** Is the user asked for commitment — pay, sign up, grant a permission — before
  receiving any value that would justify it? *Evidence: the step and what value precedes it.*

## Map coherence

- **Q-25** At each stage (selection, review, options, confirmation, matching, assignment,
  arrival, active, complete), what is the map communicating, and is it different from the
  stage before? *Evidence: one sentence per stage.*
- **Q-26** Do pickup, destination, route, Travel Number, Operator identity and state remain
  visually continuous across stages where they are relevant? *Evidence: the stage where one
  disappears.*
- **Q-27** Is any schematic or simulated map presented in a way a Traveler could reasonably
  read as live geographic tracking? *Evidence: the label and the data source.*
- **Q-28** Is the map a working surface, or is it wallpaper behind panels? *Evidence: the
  fraction covered during active travel; what the uncovered part tells the user.*

## Meaningful motion

- **Q-29** Does every animation explain a state change or spatial relationship? *Evidence:
  name any that decorates.*
- **Q-30** Does every animation stop when its underlying state is no longer true? *Evidence:
  what still moves after completion or after matching.*
- **Q-31** Do sheets and panels originate from a logical place, and do transitions preserve
  spatial continuity? *Evidence: the transition that jumps.*
- **Q-32** Is the app static anywhere it should not be — a state change that appears with
  no transition, information that vanishes rather than transitions? *Evidence: name it.*

## Trust

- **Q-33** Does the app ever state a price and, elsewhere or later, a different price for the
  same travel? *Evidence: the two screens.*
- **Q-34** Does the app ever promise a thing the product does not do — a code that was not
  sent, a reminder that is not scheduled, a check that is not performed? *Evidence: quote it.*
- **Q-35** Does anything on screen expect to be doubted — a reassurance, a defensive
  qualifier, a badge whose only job is to say "trust this"? *Evidence: quote it.*

## Product truth

- **Q-36** Is every feature on screen real, simulated, or merely described — and is the
  distinction made honestly to the user where it matters (test program, simulated payments,
  simulated review)? *Evidence: the feature and how the screen labels it.*
- **Q-37** Where the product deliberately withholds something (a suggested-travel section a
  new account has not earned, a rating no record supports), is the absence clean rather than
  replaced by furniture? *Evidence: the empty state.*

## Missing product ideas

- **Q-38** Is there anything a Traveler in Miami would reasonably expect that is not here and
  would surprise them at the moment they need it? *Evidence: if YES, name three, ranked by the
  moment of need.*
- **Q-39** Is there anything an Operator doing this for a living would expect of a professional
  instrument that is not here? *Evidence: if YES, name three.*
- **Q-40** Is there an opportunity the founders have not asked about that would materially
  improve comprehension, continuity, or trust? *Evidence: describe it in one paragraph.*

## Engineered, not decorated

- **Q-41** Does the interface feel engineered — every element earning its place, alignment
  exact, states explicit — rather than decorated? *Evidence: the element that is decoration.*
- **Q-42** Is any of the visual language generic — startup, SaaS, marketplace — rather than
  American Rider's? *Evidence: the component and what it resembles.*
- **Q-43** Reviewing this as another senior designer's work: does it look intentional, and is
  anything missing that the last reviewer should have caught? *Evidence: name it.*
