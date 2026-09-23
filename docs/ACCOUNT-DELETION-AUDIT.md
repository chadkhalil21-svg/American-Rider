# Account deletion: current-state data inventory

This document records the behavior at the time of the security remediation. It does not set a
retention policy. Legal and founder decisions are required before the product changes this flow.

## Current sequence

`AuthContext.deleteAccount` reauthenticates the current email-and-password account. It then:

1. queries Travels where `travelerUid` is the current UID and tries to delete each document;
2. tries to delete `users/{uid}`;
3. clears all American Rider data stored on that device; and
4. deletes the Firebase Authentication account.

The Travel deletion attempt fails because Firestore rules deny all client Travel deletion. The
error is caught and the sequence continues. The profile deletion is permitted, but its error is
also caught. No privileged server deletion or anonymization runs.

## Inventory

| Data category | Current result | Access after Authentication deletion | What a future change needs |
| --- | --- | --- | --- |
| Firebase Authentication account | Deleted after successful recent-login reauthentication | The account cannot sign in | A policy must decide whether deletion can proceed when retained records still identify the UID |
| `users/{uid}` Traveler/Operator profile | Client attempts deletion; rules permit it; failure is ignored | If deletion fails, the former account cannot read it, but administrators can | Privileged deletion or anonymization is required for a guaranteed result; financial, qualification and screening fields need retention decisions |
| `rides` Travels where the account is Traveler | Client attempts deletion; rules reject every attempt | Not readable by the deleted account; retained for administrators and the assigned Operator while that Operator account exists | Privileged deletion or anonymization and a transport/financial-record retention decision |
| `rides` Travels where the account is Operator | Not queried or deleted | The deleted Operator cannot read them; Travelers on the records can still read their own Travels | Privileged deletion or anonymization and the same transport/financial-record decision |
| Travel `announcements` subcollections | Not deleted | Not directly granted to clients; retained for administrators | Privileged recursive deletion or retention decision |
| `messages` Travel messages | Not deleted | The deleted party cannot authenticate; the other current party can read messages authorized by the rules | Privileged deletion or anonymization and a communications/evidence retention decision |
| PaymentIntent, refund, tip and transfer references on Travels | Not deleted | Not readable by the deleted account; retained in Firestore and Stripe | Financial-record retention decision and coordinated Stripe/Firestore anonymization |
| Stripe Customer and saved payment methods | Not deleted or detached | Not reachable through the app after Auth deletion; Stripe retains the Customer and methods | Privileged Stripe cleanup and a payment/chargeback/financial retention decision |
| Stripe Connect account reference (`users.stripeAccountId`) | Deleted only if the profile deletion succeeds; Stripe account is not deleted | The former Operator cannot use the app; Stripe and other retained records can still hold the reference | Privileged Stripe action and tax/payout/financial retention decision |
| `lost_items` reports | Not deleted | The deleted Traveler cannot read them; administrators retain access | Privileged deletion or anonymization and a lost-property/evidence retention decision |
| `lost-items/{uid}/…` photographs | Not deleted; Storage rules prohibit client deletion | The deleted Traveler cannot authenticate to read them; administrators retain access | Privileged Storage deletion and a lost-property/evidence retention decision |
| Traveler support, emergency and lost-item cases in `support_tickets` | Not deleted | Already inaccessible to clients; administrators retain access | Privileged deletion or anonymization and support, safety and legal retention decisions |
| Operator support cases/messages in `support_tickets` | Not deleted | Already inaccessible to clients; administrators retain access | Privileged deletion or anonymization and employment-independent contractor dispute retention decisions |
| `operators/{uid}` profile and fleet state | Not deleted or taken off duty by account deletion | Not readable from a phone; administrators retain it. A stale available record can remain until presence gates exclude it | Privileged disable/anonymization; founder decision about immediate fleet removal should precede implementation |
| Qualification state and first-party document readings in `users/{uid}` | Deleted only if profile deletion succeeds | If retained after a failed profile deletion, only administrators can read it | Privileged deletion/anonymization and statutory qualification-record retention decision |
| `operator-documents/{uid}/…` uploaded licence, registration, inspection and insurance images | Not deleted; Storage rules prohibit client deletion | The deleted Operator cannot authenticate to read them; administrators retain access | Privileged Storage deletion and statutory/insurance/evidence retention decision |
| Checkr screening result or references in `users/{uid}.screening` | Deleted only if profile deletion succeeds | Checkr and any retained profile/order records remain outside the deleted login | Provider-side and Firestore privileged action; FCRA, dispute and statutory retention decisions |
| `screeningOrders` | Not deleted | Not client-readable; administrators retain access | Privileged deletion/anonymization and screening/payment retention decision |
| Push token and preferences in `users/{uid}` | Deleted only if profile deletion succeeds | A retained token is not reachable by the former account, but server notification code can still read it | Privileged guaranteed token clearing should be considered separately from record retention |
| `waitlist/{uid}` | Not deleted | Not client-readable after account deletion; administrators retain access | Privileged deletion/anonymization and marketing-consent retention decision |
| `scheduled_rides` | Not queried or deleted | The deleted Traveler cannot read them; the scheduler can still process a reserved record | Privileged cancellation is required to prevent later dispatch or charging; the refund/record treatment needs a product and legal decision |
| `audit_log` operations records | Not deleted | Operations-only | Tamper-evident audit retention and anonymization decision |
| Local AsyncStorage data (`ar:` account and device data) | Deleted before Authentication deletion | Removed from that device | No server-side effect; other devices are unchanged until they sign out or clear storage |

## Decisions required

Counsel and the founders must specify retention periods and anonymization requirements for
transport records, payment records, tax and payout records, safety/support evidence, lost-property
records, qualification documents, screening records, audit records and marketing consent. A
privileged server workflow is required for any guaranteed deletion, anonymization, Storage cleanup,
Stripe cleanup, cancellation of scheduled Travel, or removal from the active fleet.
