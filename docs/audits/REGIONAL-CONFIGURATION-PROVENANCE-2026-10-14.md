# Regional configuration provenance

Date: 2026-10-14

Decision: Show code-verifiable subcontrols in regional readiness, while keeping separate approval requirements for the entire business process.

The existing market engine checks three facts without new data entry: the South Florida tariff and currency, a defined toll policy, and the current operator disclosure. The readiness response identifies the source and reports that additional operational verification is still required.

This is a reporting and configuration-review change. It does not change the rules for activating a region, driver eligibility, payments, or any required external verification.

Validation: the new market-config-mapping test exercises all three South Florida counties twice. Six existing release workflows must pass before deployment.
