# Resend insurance-email delivery commissioning

Research before design: [Resend signed callbacks](https://resend.com/changelog/managing-webhooks-via-api), [per-recipient event formats](https://resend.com/changelog/webhook-event-visibility), [Google SRE launch checklist](https://sre.google/sre-book/launch-checklist/), [Firestore transaction retry rules](https://firebase.google.com/docs/firestore/manage-data/transactions).

Source comparison: the existing insurance verification request stores `providerMessageId`, but the connected Resend account had zero webhooks on 2026-10-11. An accepted send is not proof of email delivery, and neither proves active insurance.

New code uses a 32 KiB raw-body endpoint, signed five-minute Resend/Svix verification, the existing durable provider event queue, indexed lookup by exact outgoing email ID, recipient matching and monotonic delivery outcomes. Bounce, complaint, suppression and send failure can open a current policy-matched Operator contact-correction issue. Duplicate, out-of-order, spoofed and stale callbacks do not change insurance authorization. **No delivery event can update insurer policy status, lastVerifiedAt, screening or live market admission.**

After exact CI and deployment verification, commission the Resend webhook only through an authorized provider connection. Store its signing secret privately in Render, enable delivery/sent/bounce/failure/complaint/suppression signals, then test real signatures and provider test addresses. Actual callback delivery, insurer confirmation, physical devices, Stripe money and Florida legal review are separate unverified gates.

No new vendor or subscription. The queue creates Firestore read/write overhead per accepted event; measure it at scale, especially unrelated mail events. Never turn a synthetic provider event into a commercial qualification decision.
