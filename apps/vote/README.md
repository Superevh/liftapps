# VoteLift (现场互动)

Live presentations for Lift Apps by AIYun (https://liftapps.com.au/vote/app/): presenters sign in, build decks
from templates with 13 slide types, and present; the audience joins on their phones with an 8-digit code (or QR)
and results update live. Bilingual (English / 中文, driven by the family `<lift-bar>` switch); light Lift Apps
theme by default with an optional warm espresso presenting mode.

## Slide types

Interactive: multiple choice (bars / donut / pie / dots), word cloud, open ended, scales, ranking,
100 points, Q&A with upvotes. Quiz: timed questions scored for speed on the server clock, leaderboard.
Content: heading, bullets, quote, image.

## Run it

```bash
npm install
npm run dev:local      # local mode: the production SQL in PGlite (API on :54302), no Supabase needed, any email signs in
npm run dev            # against Supabase (.env.local)
npm run build          # -> dist/vote/app (served at /vote/app/)
```

Dev server: http://localhost:5302/vote/app/. Local mode serves phones on the same Wi-Fi too (`vite --host`).
`DEV_DB=memory npm run dev:local` starts from an empty database; otherwise data persists in `.devdb/`.

Routes are hash-based under the `/vote/app/` base: `#/` dashboard, `#/edit/:id`, `#/present/:id`, `#/results/:id`,
and `#/12345678` / `#/join` for the audience. Join links and QR codes are built from the current location,
so production links read `https://liftapps.com.au/vote/app/#/12345678`.

CSP lives in `index.html`. The dev server adds `'unsafe-inline'` to script-src (React Refresh preamble) and `ws:`
to connect-src (HMR) only while serving; builds keep the strict policy.

## Supabase setup (shares the existing Supabase project, live_* tables)

1. Run `supabase/live.sql` in the Supabase SQL Editor. It only creates `live_*` tables and functions and
   leaves the other apps' objects and grants untouched. Re-running it is safe.
2. Authentication → URL Configuration: add this app's URLs (`http://localhost:5302/vote/app/`,
   `https://liftapps.com.au/vote/app/`) to Redirect URLs so email links and Google/GitHub sign-in can return here.
3. `.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_PROVIDERS=google,github`.

## Built for 100 people in the room

Supabase Free: 200 concurrent Realtime connections and 100 messages/second, where a broadcast to N
subscribers counts as N messages. The design keeps Realtime for the rare presenter → audience events only:

| Traffic | Path | Cost with 100 participants |
|---|---|---|
| Votes, questions, upvotes, reactions | RPC (HTTP) → Postgres | 0 Realtime messages |
| Slide change, show results, lock, quiz start/reveal | one Realtime broadcast | ~100 messages per action |
| Presenter's live results | `live_results` once a second, only new rows | 1 request/second |
| Audience fallback | `live_poll` every 10 s | ~10 requests/second |

All validation (one vote per person, only the current slide, locked slides, answer shapes, quiz timing and
scoring) happens in security-definer functions; tables are closed to clients.

`npm run loadtest` simulates a presenter and 100 participants (each with its own Realtime connection)
through multiple choice, word cloud, scales and a timed quiz, and reports delivery and latency. Against
Supabase: `LOADTEST_TARGET=supabase LOADTEST_EMAIL=… LOADTEST_PASSWORD=… npm run loadtest`.

## Layout

```
supabase/live.sql      schema + RPCs (the server)
scripts/dev-server.mjs local server: live.sql in PGlite over HTTP + SSE
scripts/loadtest.mjs   100-participant load test (local or Supabase)
src/backend.js         one API over Supabase or the local server
src/slides.js          slide types, defaults, aggregation
src/templates.js       presentation templates
src/Dashboard.jsx      my presentations + template picker
src/Editor.jsx         three-pane slide editor
src/SlideView.jsx      renders any slide with live results
src/Present.jsx        full-screen presenter
src/Audience.jsx       phone experience
src/ResultsPage.jsx    results + CSV export
```
