# Putting the server online (Render) — in plain English

## Why this is needed

Right now the American Rider server runs **on Adrian's Mac**. That is fine for testing in a
browser on that same Mac, but it does not work on a real phone.

The reason: the app looks for the server at an address called `localhost`. `localhost` does not
mean "Adrian's Mac" — it means **"the machine I am currently running on."** On the Mac that is
the Mac. On an iPhone, it is the iPhone itself, which is not running any server. So the phone
looks for the server inside itself, finds nothing, and gives up.

The fix is to put the server on a computer that is always on and has a public address, so any
phone anywhere can reach it. That is what Render does.

**Until this is done**, the app will install on the iPhone and the screens will look right, but
anything involving money or the assistant will fail: prices, payments, and trip planning.

## What is already prepared

- **`render.yaml`** (repo root) tells Render exactly how to run the server, so nothing has to be
  configured by hand.
- **`src/config.ts`** no longer hardcodes the Mac. It uses the hosted address when one is set,
  and otherwise falls back to the Mac automatically for local testing. Nothing to remember.
- The server already reads the port Render assigns it, and already has a `/health` page that
  Render can ping to confirm it is alive.

## What Adrian needs to do (about 10 minutes)

1. Go to **render.com** and create a free account. Sign in with GitHub — it is the fastest route
   and lets Render see the repo.
2. Choose **New → Blueprint**.
3. Pick the **American-Rider** repository. Render finds `render.yaml` on its own and fills in
   every setting.
4. It will ask for two secret values. These are the **same keys** that are in `backend/.env`:
   - `STRIPE_SECRET_KEY`
   - `ANTHROPIC_API_KEY` (leave blank if not obtained yet — the assistant simply stays off)

   Paste them into Render's own boxes. They are stored encrypted on Render and never touch the
   repo.
5. Click **Apply**. The first build takes a few minutes.
6. Render gives back a public address, something like
   `https://american-rider-server.onrender.com`. **Send that address to Claude.**

## What happens after that

Claude sets that address in `eas.json` so every phone build points at the hosted server, then
rebuilds. Local browser testing keeps using the Mac exactly as before — no switching back and
forth.

## Worth knowing about the free tier

Render's free plan **puts the server to sleep after about 15 minutes of no use.** The next
request wakes it, which takes roughly **50 seconds**. During that wait the app looks frozen or
throws an error.

This is fine for testing and for showing people. It is **not** acceptable once real travelers are
booking rides — a 50-second wait to see a price would lose the customer. The paid plan is about
**$7/month** and removes the sleeping entirely. That upgrade should happen before any real launch,
not before testing.

## Security note

The keys live in exactly two places: `backend/.env` on the Mac (which git refuses to commit) and
Render's encrypted settings. They are not in this repository and must never be pasted into a
chat, a screenshot, or a commit.
