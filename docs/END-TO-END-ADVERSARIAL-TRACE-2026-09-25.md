# End-to-End Adversarial Travel Trace — 25 September 2026

This document is a release artifact, not product copy. It traces authority, state and money through one fictional Operator and one fictional Traveler and names the transition that must fail when attacked.

## Operator trace — “Elena O.”

1. Account and market. Firebase establishes uid `op_elena`. POST /operator/market records an active operating market. A client cannot create or mutate `operators/{uid}`; Firestore denies it.
2. Documents. Each first-party document is uploaded into the authenticated Operator namespace. POST /operator/document signs the read URL, AI extracts structured evidence, and qualification.js independently re-checks type, legibility, identity, vehicle, dates, commercial use and statutory limits. AI output is evidence, not authority. A non-accepted replacement immediately removes availability.
3. Screening. Elena either pays the pass-through screening charge or instructs an earlier screening agency to send the report directly. An Operator-uploaded report never becomes a pass. Checkr/provider evidence enters the durable webhook inbox before acknowledgement. screening.js applies American Rider's statutory rules. A proposed refusal becomes pre-adverse; provider-hosted notice/dispute runs; corrected evidence is re-adjudicated; only completion becomes final refusal. Ambiguous source mapping fails closed.
4. Insurance disclosure. The exact disclosure text/version/language shown is stored with acknowledgement. A stale version blocks duty.
5. Stripe Connect. POST /connect/onboard creates/resumes the server-owned account mapping. The client cannot choose the payout destination. Payouts must be enabled before duty.
6. Duty. POST /operator/online re-runs account, documents, screening, disclosure and payouts and requires a server-observed position. The fleet record is a dispatch snapshot, not qualification authority. Background presence renews it; stale presence removes dispatchability.
7. Assignment. POST /travel/dispatch uses server pricing and server fleet matching. Elena cannot assign herself. The ride is `assigned` and names her uid.
8. Acceptance. POST /travel/accept re-reads ride + user + fleet in one transaction and re-runs qualification in `accept` context. Insurance expiry, suspension, disclosure change, screening hold or payout loss between assignment and tap releases the Travel instead of accepting it.
9. Travel progression. Firestore permits Elena to move only her assigned Travel through the narrow status ladder and position fields. She cannot alter fare, Booker, Traveler, payment, operator assignment or rating. A forged jump is denied.
10. Completion and payout. Completion sets the payout queue marker, but the marker authorizes no money. Settlement re-reads the completed ride, its own PaymentIntent and the Operator's server-owned Connect account. transferToOperator derives 99% + toll reimbursement from Stripe-stamped fare metadata. Idempotency prevents a duplicate transfer. Failed settlement remains owed and is retried.
11. Monthly Connect account cost. A payout event records that Elena caused an active-account month. At month close, >=20 completed Travels waives the $2 cost; below 20, Elena is charged the $2 cost plus only its collection-processing cost. It is separate from her 99% fare share and is not socialized into Traveler pricing.

Attacks that must fail: forged screening pass; client-written insurance acceptance; changed payout account; stale duty heartbeat; accepting after expiry; accepting somebody else's offer; changing fare; premature completion by Traveler; duplicate settlement; provider webhook replay; process death after webhook acknowledgement; two scheduler instances; one-Travel Operator externalizing the monthly Connect account cost.

## Traveler trace — “Alex B.”

1. Account. Firebase uid `trav_alex` owns the booking and payment relationship.
2. Quote. /fare-quote derives route, fare, class, government fees, tolls, card-country cost schedule and platform fee on the server. A client-sent amount is not authority.
3. Party declaration. The Booker states self or another adult. The server normalizes this declaration and another-person Travel requires the physical Traveler's name. Unaccompanied-minor Travel fails closed at launch until carrier, Florida counsel and operating procedures explicitly approve that separate service.
4. Dispatch. /travel/dispatch prices again, verifies active market/route, matches an eligible Operator, creates the authoritative ride, and stores Booker/Traveler party semantics. The phone cannot create the ride or select an Operator.
5. Payment. /create-payment-intent first proves that the ride exists, belongs to Alex and is payable. Stripe amount comes from the ride. A retry resumes the same PaymentIntent. The client cannot substitute another ride, amount or Connect destination.
6. Assignment and identity. Alex receives the matched Operator's name, vehicle, plate and Travel Number. For a Travel booked for another person, the Operator receives the Traveler identity needed at pickup rather than assuming the cardholder is physically present.
7. Follow/safety. A Booker can mint a high-entropy follow link only for their active Travel. The link shows route, Operator/vehicle and fresh vehicle position, not account history or phone number, and expires. A parent traveling with a child can use this ordinary Booker safety surface; American Rider does not launch an unaccompanied-minor service.
8. Travel. Operator status drives the Traveler screen. Traveler cannot mark the Travel complete or cancel around the server refund path. Messaging is ride-bound and identity-bound.
9. Cancellation. Before arrival, the Travel's own payment is refunded. After Operator arrival, the $3 arrival amount is withheld and passed to that Operator. Onboard/completed Travel cannot be cancelled through this route.
10. Completion. Operator marks completion. Settlement pays the Operator from the Travel's own PaymentIntent. Receipt records the actual payment method, distance/time, Operator and government fees. Optional rating is feedback only. American Rider has no tip/gratuity product or post-Travel tip money path.

Attacks that must fail: price tampering; cross-account ride payment; duplicate PaymentIntent; fake Operator destination; Traveler-completed Travel; refunding a different payment; cross-travel messages; public fleet enumeration; stale follow link; fake tip field/endpoint.

## Smart Travel

Smart Travel is a journey composed of up to two real car Travels around a transit leg. Each car Travel has its own Operator, Travel Number, payment and settlement. Leg 2 may reference only a paid first leg owned by the same Booker. The platform fee is calculated at journey level over the combined car fare and two transaction-cost units; leg 2 carries only the incremental fee not already carried by leg 1. Journey-level economics must preserve two contribution units when there are two charged car legs. Transit fare is not represented as an American Rider charge unless the platform actually collects it.

## Communications

Traveler↔Operator chat remains Travel-scoped. American Rider↔Operator communications are a different record: a durable platform inbox for qualification, insurance, screening, payout, policy, support and operations notices. Push is a notification channel, not the record. A missing push therefore cannot erase a required notice. Clients cannot forge institutional messages.

## Release evidence still requiring physical/provider systems

Unit and integration tests cannot prove iOS/Android process suspension behavior, APNs/Expo delivery, Checkr production adverse-action behavior, Stripe production settlement timing, bank payout timing, carrier cancellation feeds, or regional network outages. These require staged provider accounts and physical-device campaigns before launch.
