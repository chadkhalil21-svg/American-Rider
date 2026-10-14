# Insurance self-report experience — source-based Council review
14 October 2026 · American Rider · candidate UI correction (no changed underwriting policy)

## Founder question answered from release/current
**When is the self-report made/presented?** Until this candidate, `app/operator/insurance.tsx` displayed a nonpayment warning explanation and two report controls on the regular **Commercial Insurance** page at all times, whether coverage was current or not. The page was accessible from the permanent Operator drawer's Insurance item. The software did NOT automatically ask on shift commencement, at booking, daily, or in response to unpaid premiums (which it cannot observe without an authenticated external source). If they deliberately selected a choice, a native confirmation preceded a transaction that removed new-Travel eligibility. Existing provider status monitoring can independently report cancellation or pending cancellation, but monthly checks are not real-time premium-payment information.

## Published design and engineering criteria (sources, not literal council meetings)
- **Apple HIG Alerts**: avoid interruptions except for important immediately actionable conditions; no alert at startup. https://developer.apple.com/design/human-interface-guidelines/alerts
- **Apple HIG Notifications**: suppress duplicate notices, keep sensitive information out of lock-screen push; use in-context cues when active. https://developer.apple.com/design/human-interface-guidelines/notifications
- **NN/g, Jakob Nielsen**: visibility, real-world language, error prevention, recovery and minimalist content; **progressive disclosure** keeps rare exception actions out of routine workflows without making them unreachable. https://www.nngroup.com/articles/ten-usability-heuristics/ ; https://www.nngroup.com/videos/progressive-disclosure/
- **Google SRE**: automated repeated confirmation and exceptional human intervention, not routine recurring form tasks. https://sre.google/workbook/eliminating-toil/
- **Microsoft Azure Well-Architected Reliability**: alerts should be actionable, tied to meaningful health-state changes, and resistant to alert fatigue. https://learn.microsoft.com/en-us/azure/well-architected/reliability/monitoring
- **Stanford d.school**: prototype, observe realistic users, and iterate: a synthetic green suite is not observed ease-of-use. https://dschool.stanford.edu/stories/integrative-design-a-practice-to-tackle-complex-challenges
- **UK public service design standard**: minimize steps, test on actual devices, cover every touchpoint including external channels, and provide consistency. https://www.gov.uk/service-manual/service-standard/point-4-make-the-service-simple-to-use
- **Amazon Builders' Library**: server-side idempotent/atomic actions should handle retries without duplicate work. This is already present in the report-risk transaction; no new persistence system. https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-apis/

## Recommended and implemented candidate
1. Replace always-expanded twin report actions with a single calm expandable link, **Report a change to my insurance**. Actions still accessible any time through Operator drawer -> Insurance, including while in service; no daily question or intrusive modal appears spontaneously.
2. Only on intentional expansion show the plain-language explanation and two actions (pending cancellation/nonpayment notice, and already cancelled). Only after Operator chooses an adverse status is a destructive confirmation shown. Backend immediately blocks new duty/offers/acceptance, but does not permit Operator to self-approve reinstatement.
3. Correct backend explanation: a pending cancellation could have been self-reported, so do not falsely say it came from a broker. The server still requires fresh independently authenticated source confirmation to clear the hold.
4. Test twice against existing stable synthetic policy, both event types, five languages, the permanent drawer navigation, collapsed-by-default state, and source-accurate status reason. Run six exact-commit CI campaigns and verify server/platform/preview deployment before claiming live.

## What NOT to do or claim
- Do not ask the Operator to upload each premium receipt or hand over bank/payment credentials.
- Do not demand an affirmation for every Travel or every shift; this would be low-quality evidence plus friction.
- Do not imply that self-report detects all cancellations; unreported early loss remains possible.
- Do not tell the founder the source analysis was a literal consultation or independent insurance policy.
- Do not confuse a code run, web preview, or TestFlight prior build with current on-device observed usability.
- Do not add fake insurance and screening market records to open Miami-Dade, Broward and Palm Beach. Their independently sourced status remains verified in the protected market admission database.

## Remaining human validation
A test user should be able to find the report link from In Service and Not In Service, understand that a cancellation notice immediately pauses new business, receive an actionable confirmation, and regain eligibility after an authentically confirmed reinstatement. Record results from real iPhone TestFlight and appropriately consenting Operators; no such results were observed for this candidate.
