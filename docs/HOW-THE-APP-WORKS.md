# American Rider — How the Real App Works (Chad's questions)

Plain-English answers to the practical "how does the real app actually behave" questions:
updates, testing, notifications, and background operation. Companion to
[GAME-PLAN.md](GAME-PLAN.md), [ORDER-OF-OPERATIONS.md](ORDER-OF-OPERATIONS.md).

---

## 1. Updates & Apple review (fixing things after launch)

- **Normal app updates** (a new version on the App Store) *are* reviewed by Apple — but it's
  usually **fast** (often under a day), and you can request **expedited review** for urgent fixes.
- **Our stack helps a lot:** the app will be **React Native / Expo**, which supports
  **over-the-air (OTA) updates** — many JS/logic fixes push **instantly, with no Apple review**,
  as long as they don't change the app's core purpose (Apple allows this).
- **Backend-driven changes** (prices, matching, messages, data) change **instantly, with no app
  update at all.**
- **How often?** No limit — as often as you want.

**Bottom line:** big changes = a quick review; most fixes = instant.

---

## 2. Test it free first (Chad's instinct is right)

Before going public, use **TestFlight** — Apple's **free** beta-testing tool:
- You, Chad, and your first operators install it on **real phones** and shake out bugs.
- **Internal testers** (up to 100) get builds **instantly, no review.**
- **External testers** (up to 10,000) need a light "beta review" (quick).

Test it properly on TestFlight → *then* flip it public. Smart, standard, and free.

---

## 3. Notifications & sounds

- **Push notifications are real and standard** — "Your operator is arriving," "Travel complete"
  — and they show **even when the app is closed.**
- **Sounds too** — custom notification sounds *and* in-app chimes (e.g., a sound when your
  operator is found).
- **Status today:** the demo already has the **notification settings** (the on/off toggles). The
  actual *sending* needs the push plumbing wired up (**Firebase Cloud Messaging / Apple Push**)
  in the real build — it's on the roadmap. Controls exist; delivery is backend work.

---

## 4. Does it keep working in the background? (phone locked / app switched)

**Yes — because the real work happens on the *server*, not the phone.**

- **Matching/search runs on the backend.** If a traveler **closes the app or switches away, the
  server keeps finding/assigning their operator** and then **pushes a notification.** The ride
  does **not** stop because the phone is locked.
- Phones (especially iPhones) **suspend apps in the background** to save battery — that's normal
  and unavoidable. You don't need the app "running" the whole time, because the **server does the
  work** and **notifications keep the user informed.** Reopening the app **syncs to the current
  state.**
- **The operator app** (needs live location while driving) uses **background location
  permission**, so it keeps sending the car's position even when backgrounded or locked.
  **This is exactly how Uber and Lyft work.**

**Bottom line:** it keeps going — the engine is the server; notifications + background location
bridge the gap. Standard, correct architecture.

---

## Where this sits

None of this needs building *today* — it's part of the **real backend + mobile stage** (see the
game plan). The demo already **mocks the settings/controls**; the actual delivery (push service,
background location, OTA updates, TestFlight) is wired up during the real build.
