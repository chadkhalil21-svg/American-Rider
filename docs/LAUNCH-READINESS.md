# American Rider — Launch-Readiness Review ("What we're not yet considering")

Adrian asked the right question: *before we go live, what haven't we thought about?*
This is the honest gap list — appearances, language, capabilities, and the things a
rideshare specifically must have that are easy to miss. It's a companion to
[LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) (which covers the *engine*: accounts,
payments, maps, matching).

Each item is tagged:
- 🔴 **BLOCKER** — cannot legally or safely launch without it
- 🟡 **SOON** — needed within weeks of launch
- 🟢 **GROWTH** — makes us better, not required day one

---

## ⭐ If we only stress five things

1. 🔴 **A rideshare operating license (TNC registration).** In most U.S. states you legally
   *cannot* run a rideshare without registering as a **Transportation Network Company**.
   Florida has its own TNC law (Ch. 627.748) with insurance minimums, background-check
   standards, and a zero-tolerance policy baked in. This is the #1 thing people forget.
2. 🔴 **Rideshare insurance with three driving periods** — not just the BOP. Coverage differs
   when the app is *on & waiting*, *matched & driving to the traveler*, and *traveler in the
   car*. TNC law mandates specific minimums for each. This is specialized commercial coverage.
3. 🔴 **Real background checks + vehicle inspections** via a vendor (e.g. Checkr). A "Verified"
   badge in the demo is not a background check. No stranger gets in a car without this.
4. 🔴 **A cold-start plan.** A marketplace with no operators has no riders, and vice-versa.
   Pick **one city** (Miami), sign up operators *first*, then open to riders. Nationwide-at-once
   is how marketplaces die.
5. 🟡 **Tipping + 1099 taxes.** Operators will expect tips (100% to them) and, as contractors,
   a year-end 1099 and an in-app earnings/tax summary. Both are competitive table-stakes.

---

## 1. Legal & regulatory (to actually operate)
| Item | Tag | Plain English |
|---|---|---|
| TNC / rideshare registration | 🔴 BLOCKER | The license to legally operate a rideshare (state-level; FL Ch. 627.748) |
| 3-period rideshare insurance | 🔴 BLOCKER | Coverage for app-on-waiting, en-route, and passenger-aboard |
| Background checks + inspections | 🔴 BLOCKER | Real vendor screening before anyone drives |
| Airport permits + geofencing | 🟡 SOON | Airports require separate permits and marked pickup zones |
| Business entity (LLC) + local licenses | 🔴 BLOCKER | The company, its bank account, and any city business license |
| Contractor agreement + classification | 🔴 BLOCKER | Protects the "operators keep their autonomy" model (already reframed in the app) |
| Data-privacy compliance | 🟡 SOON | We hold live location data — handle it lawfully (CCPA-style rules) |
| Accessibility (ADA / wheelchair vehicles) | 🟡 SOON | Some jurisdictions require accessible-ride availability |

## 2. Operator recruiting & retention *(Adrian's example)*
| Item | Tag | Plain English |
|---|---|---|
| "Why operate with us" pitch | ✅ DONE | Value, not just numbers — added to the Become-an-Operator screen today |
| Operator referral program | 🟡 SOON | Operators recruiting operators is the cheapest growth we have |
| Onboarding tracker | 🟡 SOON | "You're 2 steps from your first ride" — reduces drop-off during signup |
| First-week earnings guarantee | 🟢 GROWTH | A safety net that gets the first operators to try us |
| Fast payout (bank onboarding / KYC) | 🔴 BLOCKER | Operators must connect a bank and pass identity checks to get paid (Stripe Connect) |
| Operator support in Spanish | 🔴 BLOCKER | Chad's first operators are Spanish speakers — real humans, not just translated UI |

## 3. Rider acquisition & trust
| Item | Tag | Plain English |
|---|---|---|
| Rider-side "why us" | 🟡 SOON | Why a rider picks us: fair price + you're directly supporting the driver |
| First-ride promo + referrals | 🟡 SOON | The push that gets someone to try a new app |
| Persistent ratings & reviews | 🟡 SOON | Stars that actually save and shape matching |
| Clear cancellation policy | 🟡 SOON | When is a cancel free vs charged — stated plainly |
| Rider identity verification | 🟡 SOON | Reduces fraud and protects operators |

## 4. Money mechanics not yet covered
| Item | Tag | Plain English |
|---|---|---|
| Tipping (100% to operator) | 🟡 SOON | Expected by operators and riders alike |
| Refunds / disputes / chargebacks | 🔴 BLOCKER | A real process when a charge is contested |
| Surge / dynamic pricing decision | 🟡 SOON | Do we raise prices in high demand? A *no*, or a *transparent yes*, can be a differentiator |
| 1099 tax reporting + in-app summary | 🟡 SOON | Legally required for contractors; give operators their numbers |

## 5. Safety (trust + regulatory)
| Item | Tag | Plain English |
|---|---|---|
| In-app emergency (911 + live location) | 🔴 BLOCKER | The Safe Travels screen exists; the button must really call and share location |
| Two-way ratings + report/block | 🟡 SOON | Both sides rate; bad actors get removed |
| 24/7 incident response | 🔴 BLOCKER | A real human path when something goes wrong on a ride |
| Lost & found flow | 🟢 GROWTH | Getting a phone back to a rider |

## 6. Language / localization *(Adrian's category)*
| Item | Tag | Plain English |
|---|---|---|
| Spanish (UI + support + legal docs) | 🔴 BLOCKER | Not just the app text — support and contracts too |
| French, German, Mandarin | 🟢 GROWTH | Chad's follow-on list |
| Arabic (right-to-left layout) | 🟢 GROWTH | A day-one design decision if we add it — the whole layout mirrors |
| Auto-translating in-ride chat | 🟢 GROWTH | Operator and traveler type in their own language |

## 7. Appearances / brand *(Adrian's category)*
| Item | Tag | Plain English |
|---|---|---|
| Logo + app icon | 🔴 BLOCKER | Still waiting on the logo asset; needed for the app stores |
| Marketing website + sign-up funnel | 🟡 SOON | Where riders and operators first land — separate from the app itself |
| App Store / Play Store listing | 🔴 BLOCKER | Screenshots, description, and passing Apple/Google review (weeks, and strict for ride + payment apps) |
| Branded emails / texts | 🟡 SOON | Verification codes, receipts, alerts — all should look like us |
| Empty / error / loading states | 🟡 SOON | The unglamorous screens that make an app feel finished |

## 8. Capabilities / features *(Adrian's category)*
| Item | Tag | Plain English |
|---|---|---|
| Schedule a ride for later | 🟡 SOON | Book now for a set time (airport runs) |
| Multiple stops | 🟢 GROWTH | Add a stop mid-trip |
| Accessible-vehicle option | 🟡 SOON | Request a wheelchair-accessible ride |
| Business / expense profiles | 🟢 GROWTH | Work rides, emailed receipts, expense export |
| Promo codes | 🟡 SOON | Powers referrals and first-ride offers |

## 9. Back office / operations
| Item | Tag | Plain English |
|---|---|---|
| Admin dashboard | 🔴 BLOCKER | Where you & Chad approve operators, watch fraud, issue refunds |
| Support system (both sides, multilingual) | 🔴 BLOCKER | Tickets / chat / phone for riders and operators |
| Fraud detection | 🟡 SOON | Fake rides, GPS spoofing, stolen cards |
| Analytics / metrics | 🟡 SOON | Knowing what's actually happening in the market |

## 10. Technical readiness
| Item | Tag | Plain English |
|---|---|---|
| Backend that scales | 🔴 BLOCKER | Real servers behind the demo (the "engine" in the other checklist) |
| App Store approval | 🔴 BLOCKER | A gate of days-to-weeks; plan for it, don't be surprised |
| Real-device testing | 🟡 SOON | It works on *your* phone ≠ it works on everyone's |
| Push notifications infra | 🟡 SOON | The real system behind the notification toggles we built |

---

## The one paragraph for Chad

> The demo proves the product. Before a single paid ride with a stranger, four things are
> non-negotiable: a **rideshare operating license (TNC registration)**, **3-period rideshare
> insurance**, **real background checks + vehicle inspections**, and a **cold-start plan for
> one city (operators first)**. Everything else — tipping, taxes, referrals, more languages,
> the marketing site — is important but can follow close behind. The good news: none of this
> changes the product or the 99% model. It's the license, the insurance, and the paperwork
> that turn a beautiful demo into a business that can legally put people in cars.
