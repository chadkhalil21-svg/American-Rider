# American Rider — Operator Insurance Disclosure

> **DRAFT — COUNSEL/BROKER REVIEW REQUIRED BEFORE PRODUCTION USE**
>
> American Rider's operating model requires every Operator to procure and continuously maintain
> their own qualifying commercial/livery/TNC automobile coverage. American Rider does not sell
> automobile insurance and does not intend to substitute a platform automobile policy for the
> Operator's required policy.
>
> Florida counsel must approve the final disclosure against the then-current text of Fla. Stat.
> §627.748, including subsection (7)(d), before an Operator provides Travel. The application must never imply that an
> uploaded certificate overrides the statute or the underlying policy.

## Operator coverage requirement

Before an Operator may commence operations, the policy on file must:

- recognize TNC, livery, commercial for-hire or equivalent passenger-for-compensation use;
- cover the Operator and registered vehicle;
- be effective and unexpired;
- satisfy every applicable Florida TNC limit and required coverage; and
- be issued by an insurer eligible under Florida law.

For the current Florida rule configuration, the application checks the logged-on/not-engaged
limits, the prearranged-Travel liability limit, PIP, and UM/UIM evidence against the configured
statutory requirements.

A personal policy or inexpensive rideshare endorsement is **not** represented by American Rider
as sufficient unless its actual policy language satisfies every applicable period and limit.

## Verification

The Operator submits the declarations/coverage material. American Rider's document reader
extracts what the document states; it does not decide legal compliance.

Deterministic server rules then compare:

- named insured / listed Operator;
- VIN or plate against the registered vehicle;
- effective and expiration dates;
- TNC/livery/for-hire use;
- applicable liability limits;
- PIP; and
- UM/UIM evidence.

Unreadable, ambiguous or internally inconsistent evidence is held for a person. It never
auto-passes.

The same qualification rules are re-run when the Operator goes on duty and again when a Travel
is accepted. Expired or insufficient coverage removes the Operator from service.

## Mid-term cancellation

A certificate of insurance is evidence, not a guarantee of continuing coverage. Merely naming
American Rider as a certificate holder does not itself create a contractual right to cancellation
notice. Where commercially available, the Operator should request carrier/broker evidence of any
policy endorsement that provides notice of cancellation/non-renewal to American Rider.

American Rider must also maintain a renewal/expiry monitoring process and may require refreshed
evidence or direct broker/carrier confirmation. No Operator may rely on an app reminder as a
substitute for keeping their policy continuously in force.

## Disclosure

Before first Travel, the production disclosure must state accurately:

1. what automobile insurance, if any, American Rider itself maintains;
2. that the Operator's personal automobile policy may provide no coverage while logged on or
   engaged in a prearranged Travel; and
3. that the Operator is contractually required by American Rider to maintain the qualifying
   commercial/livery/TNC coverage described above continuously.

The production wording must be approved by Florida counsel and a licensed Florida commercial/TNC
insurance broker. The repository must not contain invented insurer names, policy numbers or
coverage promises.
