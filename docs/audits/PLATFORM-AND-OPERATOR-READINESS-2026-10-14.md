# Regional launch verification scope

Date: October 14, 2026.

Regional evaluation uses market-level records, not individual Operator documents. The code now makes that distinction explicit in the readiness response.

A regression test covers the three Florida counties and confirms that each can be activated when all required market evidence is present, even when there are no individual Operator records. Missing market evidence continues to block activation.

The existing Founder command remains unchanged. Regional readiness and eligibility for each Travel are separate checks.
