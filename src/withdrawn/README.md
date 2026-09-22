# Withdrawn screens

Finished work whose ENTRY POINT was removed. Kept so a decision to reintroduce it
does not mean rebuilding it.

These files live outside `app/` deliberately. Every file under `app/` is a route,
and on the web build every route is a public URL — `app/plan.tsx` was unreachable
inside the app but still answered at `/plan` to anyone who typed it. Moving the
file out is what actually withdraws the feature; removing the link only hides it.

- `plan.tsx` — the AI planner ("Plan in your own words"), withdrawn 3 Sept 2026.
  Its server route (`src/backend/assistant.ts`) is still live.
