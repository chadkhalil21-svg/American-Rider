# American Rider — Product Overview & Platform Specification

Version 1.0 · provided by Adrian, July 7, 2026. This is the source of truth for
product direction. The Traveler app's *visual* direction is the "Friendly" style
chosen in the design phase (see `../extracted/CLAUDE.md`); ARTS™ terminology
governs operator-facing and internal surfaces.

## Vision

American Rider is a next-generation transportation platform built upon a simple
principle: **transportation should be efficient, transparent, affordable, and
respectful of the people who operate it.**

Rather than maximizing platform extraction, American Rider minimizes operational
overhead through software automation and artificial intelligence, allowing
operators to retain nearly all of their revenue while simultaneously reducing
travel costs for travelers.

American Rider is not designed to be another ride-sharing application. It is
intended to become a **national transportation operating system**.

## Philosophy

American Rider operates as transportation coordination infrastructure. The
platform connects independent operators with travelers while automating nearly
every operational process: reservations, operator selection, route optimization,
navigation, payments, revenue distribution, dispute resolution, predictive
positioning, traveler preferences, and operational analytics.

The platform exists to coordinate transportation — not to unnecessarily insert
itself into every transaction.

## Business Model

- Operator retains: **99% of the travel fare**
- American Rider receives: **1% of the travel fare (no cap)** plus the traveler's
  **platform fee: the greater of $1.50 and 5% of the travel fare, rounded up to the cent**
  ($1.50 exactly below a $30 fare — Chad, 9 Sept 2026; confirmed in writing 13 Sept 2026)
- Objective: the lowest-extraction transportation marketplace in the industry.

## Platform Principles

Institutional · Professional · Elegant · Minimalist · Authoritative ·
Predictable · Transparent · Quiet · Fast · AI-driven · Trustworthy.

No unnecessary animations, clutter, advertisements, or confusing interfaces.
The application should feel more like an aviation control system than a social
media application.

## Visual Design Language

Inspiration: Apple, Porsche, Tesla, airlines, rail operations, mission control,
government transportation systems, scientific instrumentation.

Large typography. Generous spacing. Minimal colors. Excellent contrast. Clear
hierarchy. Very little visual noise. The interface should communicate confidence.

## American Rider Transportation Standard (ARTS™)

ARTS governs every screen, notification, operation, API, and document. No
terminology should exist outside ARTS.

**Travelers:** Traveler, Traveler Account, Traveler Profile, Traveler History,
Travel Reservation, Travel Cost, Travel Number, Travel Log, Travel Review,
Travel Status, Departure, Arrival, Patron Support, Patron Relations.

**Operators:** Operator, Operator Profile, Revenue, Available for Operations,
Operator Commissioned, Commence Operation, Operation in Progress, Operation
Complete.

**Operations:** Operations Portal, Operations Console, Operations Team,
Operations Report, Operations Log. Support remains customer-facing; Operations
remains internal.

## Operator Qualification

An operator cannot begin operations until qualification is complete.

Required documents: Driver License, Vehicle Registration, Vehicle Inspection,
State-required Insurance, Identity Verification.

Only after successful verification: **Operator Commissioned**.

## Insurance

American Rider does not sell insurance. The platform verifies that every
operator satisfies state insurance requirements before becoming commissioned.
Where appropriate, provide links to recommended insurance providers offering
qualifying coverage.

## Artificial Intelligence

Deeply integrated — not as a gimmick, as infrastructure.

- **Predictive Operations:** predict future demand (weather, traffic, concerts,
  sporting events, airports, business districts, historical demand, holiday
  schedules, school dismissal, construction). Recommend where operators should
  position themselves before demand appears.
- **Revenue Roadmap:** instead of a heat map — predicted revenue, predicted
  demand, recommended operating locations, expected hourly revenue, daily
  revenue objectives.
- **AI Containment:** automatically resolve most disputes (incorrect travel
  cost, operator no-show, traveler no-show, lost property, cancellation
  disputes, GPS discrepancies, route validation). Humans intervene only when
  necessary.
- **AI Safety:** monitor unsafe driving, speeding, harsh braking, abnormal
  routes, potential fraud, repeated complaints. Generate an internal Operator
  Safety Score.
- **Traffic Prediction:** predict traffic, not merely report it. Recommend
  rerouting before congestion forms.

## Travel Preferences

Traveler selects preferences before every reservation: temperature, music,
conversation preference, quiet travel, phone charging, accessibility, child
seat, pet friendly, luggage, vehicle preference, favorite operators.

## Audio Experience

Travelers connect preferred music services (YouTube Music, Spotify, Apple
Music). The application creates a suggested playlist. Operators retain final
control over the vehicle audio system.

## Payments

Support ACH, Apple Pay, Google Pay, credit cards, debit cards. Encourage ACH by
lowering processing costs.

## Revenue Withdrawal

Operators choose Standard Transfer or Instant Transfer. Instant transfer
includes a small convenience fee.

## Transparent Pricing

Every reservation clearly shows Travel Cost, Platform Fee, Processing Fee, and
Operator Revenue. No hidden pricing.

## Multi-modal Transportation

Eventually integrate rail, airport transportation, public transit,
micromobility, first-mile, last-mile. One Reservation. One payment. One Travel
Number.

## Notifications

Reservation Confirmed · Operator Commissioned · Operator Ready for Departure ·
Travel Commencing · Travel in Progress · Arrival Approaching · Travel Complete.

## Long-Term Expansion

The same operating system should eventually support courier services, package
delivery, medical transportation, corporate transportation, airport transfers,
luxury transportation, logistics, autonomous vehicles.

## Product Goal

American Rider should feel less like downloading an application and more like
entering a national transportation network. Every interaction should communicate
professionalism, confidence, efficiency, and trust. The user should never feel
they are using "another ride-sharing app" — they should feel they are
interacting with a modern transportation institution.

## Development Philosophy

The objective is not to copy existing platforms. The objective is to build the
transportation platform we believe should exist. Every feature should answer
one question: **does this improve transportation?** If not, it does not belong
in American Rider.

## Next Phase — ARPS™

Produce the American Rider Product Specification (ARPS™) before deep
implementation. ARPS™ defines, in order: every screen, every field, every
button and its behavior, every notification, every workflow, every API
interaction, every AI capability, every database object, every permission
level, every operational state. ARPS™ is the blueprint from which the software
is engineered. (A partial ARPS draft for the Traveler app exists at
`../extracted/ARPS - Traveler Application.dc.html`.)
