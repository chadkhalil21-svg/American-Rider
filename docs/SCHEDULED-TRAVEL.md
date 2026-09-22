# Scheduled travel — how it runs, and what it needs

## What happens

A traveler reserves travel for a day and time. The reservation is a document in
`scheduled_rides` carrying the whole journey: pickup coordinates, destination, class, fare,
travel number, and the instant it is due.

`backend/scheduler.js` sweeps every 60 seconds. For each reservation inside a 25-minute
window it:

1. **Claims** it, in a transaction, so two sweeps or two server instances cannot both take it.
2. **Matches** the nearest available operator who serves the class and whose commercial
   insurance has not lapsed.
3. **Charges** the card on file, off-session, keyed on the reservation id so a retry cannot
   charge twice.
4. **Writes** the travel — the same `rides` document a live booking creates, so the operator's
   inbox, the traveler's live screen, settlement and the receipt all work unchanged.

Nothing is charged until an operator has been found, and no operator is sent until the charge
has succeeded.

### When it dispatches

Not at the appointed time — at the moment the matched operator has to leave in order to *be*
there at the appointed time. An operator four minutes away is pinged at T−7; one fifteen
minutes away at T−18.

### When it does not

| The reservation ends up | Because |
| --- | --- |
| `unmatched` | Nobody was available by ten minutes past the hour. **Nothing was charged.** |
| `payment_failed` | The card on file was declined, or the bank wants the traveler present. **No operator was sent.** |
| `needs_attention` | Charged, and the travel could not be created. A support case is opened automatically with the refund owed. This should never happen. |

Every one of these is written to the reservation and shown on the traveler's home screen.

## What it needs to be running

### 1. `FIREBASE_SERVICE_ACCOUNT`

Without it the sweep cannot read reservations and **nothing dispatches**. `GET /health` says so
under `scheduledTravel.sweeping`. Check it after every deploy.

### 2. Something to keep the clock ticking

The in-process interval is the real mechanism. On Render's **free** tier the instance sleeps
when idle and the interval sleeps with it — a reservation for 6:30 AM will not dispatch,
because nothing is awake at 6:22 to dispatch it.

Two ways to fix that:

- **Paid, $7/month.** Render's Starter tier does not sleep. The interval alone is enough.
- **Free.** Point a free cron service at `https://<server>/scheduled/sweep` every minute.
  [cron-job.org](https://cron-job.org) does one-minute intervals at no cost. The request both
  wakes the instance and runs the sweep, so the free tier works properly. GET is fine.

Set `SCHEDULER_TOKEN` in the environment if you want the endpoint authenticated; the pinger
then sends `?token=<the same value>`. Without it the endpoint is open, which is safe by
design — it takes no parameters and can only do what the clock would do a minute later on its
own.

## Route monitoring rides the same tick

`backend/monitor.js` runs in the same sweep. See the header of that file for the escalation
ladder. Both are reported by `GET /scheduled/sweep`, which is the fastest way to see what the
platform is currently doing.
