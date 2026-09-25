# American Rider — Consolidated Fare Model

Source: Chad's WhatsApp consolidation (2026-07-10). This is the OFFICIAL pricing
methodology — the demo's fixed destination prices are placeholders standing in for
formula #1; the backend implements the formula for real.

> **Corrections since this was written (15 Sept 2026).** (1) §2's fixed $1.50 became, on
> 9 Sept 2026 (Chad: "five percent"; Adrian in writing, 13 Sept), **the greater of $2.00 and the card-cost schedule: 3.25% of the travel fare for a US-issued card,
> or 5.5% for an international card, rounded up to the cent**. This 25 Sept 2026 revision funds
> ordinary Stripe Connect account/payout overhead and preserves a 25¢ operating reserve in the
> launch model rather than pricing only to card-processing break-even. (2) §3's 1% commission has **no cap** (Chad, 16 Aug 2026). (3) The formula in §1 is
> not what `backend/fares.js` implements today: $3.00 base + $1.80 per mile, $9.00 minimum,
> no time term (open P1; proposal in docs/ECONOMICS-AND-INFRASTRUCTURE.md §8). The margin
> table in §4 is at the old flat fee; current margins per fare are in that document's §2.
> The product contract in `.claude/skills/american-rider-release-review/references/` is the
> authority.

## 1. Fare formula (sets the Travel Cost — the operator's base fare)
> **Travel Cost = $2.00 base + ($0.85 × miles) + ($0.20 × minutes)**, floor of **$6.00** minimum

## 2. What the traveler sees
> **Total = Travel Cost + the platform fee** — minimum $2.00; above the floor, 3.25% of Travel Cost
> on a US-issued card or 5.5% on an international card (25 Sept 2026 Connect-cost audit). The fee is embedded and **absorbs payment
> processing**; it is never itemized and processing is never billed on top.
> One number, one blue box: *"Operator retains 99% of the travel cost — $X."*
> No Travel Cost sub-line, no Platform Fee line, no Payment Processing line. Ever.

## 3. What the operator receives
> **Operator Payout = 99% × Travel Cost** (1% commission, no cap).
> The platform fee never touches the operator's math.

## 4. Platform's real net margin per ride (internal — invisible to the traveler)
> Margin = (platform fee + 1% of Travel Cost) − actual Stripe processing cost
> (the table below is at the old flat $1.50)

| Payment method | Platform receives | Real Stripe cost (on ~$36 total) | Actual net margin |
|---|---|---|---|
| Card | $1.50 + $0.35 commission | ~$1.35 (2.9% + $0.30) | **~$0.50** |
| ACH | $1.50 + $0.35 commission | ~$0.29 (0.8%, cap $5) | **~$1.56** |

**Why ACH steering matters:** ~3× the margin on the identical trip. This is the
dollars-and-cents case behind the "Preferred" ACH nudge in the Wallet (the rider-facing
label says only "Preferred" — no fee talk on the rider surface).

## Worked example — the calibration check
12-mile, 24-minute trip:

| Step | Calculation | Result |
|---|---|---|
| Travel Cost | $2.00 + (12 × $0.85) + (24 × $0.20) | $17.00 |
| Total charged to traveler | $17.00 + $1.50 | **$18.50** |
| Operator receives | 99% × $17.00 | **$16.83** |
| Platform margin (card) | $1.50 + $0.17 − ~$0.84 | ~$0.83 |
| Platform margin (ACH) | $1.50 + $0.17 − ~$0.15 | ~$1.52 |

$18.50 lands exactly on the average-fare figure used in the volume projections —
the formula is calibrated against the existing forecast math.

## Demo status (2026-07-10)
The traveler demo implements #2 and #3 exactly: `PROC=0` (absorbed), `APP_FEE=1.50`,
all-in display everywhere (airport Standard $26.00, Premium $36.29 — Chad's exact
numbers), Smart Travel total $20.25 vs $46.50 direct. Formula #1 is backend work —
demo destination prices are hand-set placeholders.
