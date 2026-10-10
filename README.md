# American Rider

National transportation platform. Operator, Traveler and Travel are the core business terms. Current production code is `release/current`.

## Begin here

**[PROJECT-LEDGER.md](PROJECT-LEDGER.md) is the canonical start for every new chat, coding agent, collaborator or release review.**

It identifies settled founder decisions, implemented code, confirmed release evidence, outstanding real-world commissioning, current issues, and the shortest next actions. Read it **before** older summaries, issue threads, branch descriptions or unverified claims. Do not infer live market status from it: inspect protected production readiness when authorized.

- [AGENTS.md](AGENTS.md) — durable engineering/design instructions (read-first ledger link at the top).
- [Commercial release evidence](docs/COMMERCIAL-RELEASE-EVIDENCE.md) — what proves actual commercial readiness.
- [Screening-provider commissioning](docs/SCREENING-PROVIDER-COMMISSIONING.md) and [national insurance verification](docs/NATIONAL-INSURANCE-VERIFICATION-CHANNELS.md).
- [Decision records](docs/decisions/0001-phone-first-national-operations.md) — append-only history of hard-to-reverse product decisions.
- [CURRENT_HANDOFF.md](CURRENT_HANDOFF.md) — historical long-form notes, *not* current launch status.

## Working standards

Build from `release/current` only after verifying its exact SHA. For application/backend changes, run `npm run check` plus relevant release, Firestore rules and platform-build checks; certify the **exact final head**. Verify exact production Render SHA after deployment. Do not confuse tests with live Stripe transfers, real insurer/CRA data, lawful TNC admission, physical devices or scaling to a million users.

Do not introduce recurring fees, independent state-specific code forks, exclusive insurers/screeners, fabricated evidence or casual founder administration when existing, lawful, low-cost architecture suffices. Report what was actually done and what remains. Keep passwords, policy PDFs, consumer reports and payment data out of Git.

To resume from a new ChatGPT conversation with GitHub access, say: **"Computer, read American Rider PROJECT-LEDGER.md on release/current; verify the latest SHA, production and open issues; continue the highest-priority launch work without reconsidering settled decisions."**
