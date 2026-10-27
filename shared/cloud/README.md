# Lift cloud sync (`shared/cloud/`)

Cloud saving and live sharing for the workspace apps (GoalLift, DiscoveryLift, PlanLift, SketchLift).
No new database objects: a workspace is one document in the same Supabase store as RetroLift and the kit
apps (`create_board`, `append_event`, `events_since`, `save_snapshot`, Realtime channel `board:<id>`).

| File | What |
|---|---|
| `patch.mjs` | Keyed JSON diff/apply. Arrays whose items all have a unique `id` merge by id, so concurrent adds/edits from two people both survive. Everything else is last-writer-wins per field. Pure; fuzz-tested. |
| `backend.mjs` | Supabase / mock backend (copy of `apps/kit/src/core/backend.js`). |
| `cloud.mjs` | `useCloudSync()` React hook, `createWorkspace()`, `openWorkspace()`, workspace list per browser. |
| `CloudMenu.jsx` + `cloud.css` | The "● Saved · Share" pill and menu (share link, your workspaces, new workspace). EN/中文. |

## Wiring an app (GoalLift is the reference: `apps/goal/src/App.jsx`)

1. `npm i @supabase/supabase-js@2.117.2` in the app folder.
2. `vite.config.js`: `resolve: { dedupe: ["react", "react-dom", "@supabase/supabase-js"] }` (the shared files import them).
3. `index.html` CSP: `connect-src 'self' https://*.supabase.co wss://*.supabase.co`.
4. Keep the app's own state and localStorage cache. Add:
   ```js
   const [hasLocal] = useState(() => !!load())            // false when showing a fresh example
   const sync = useCloudSync({ app: 'goal', prefix: 'gl', state: shared, setState: fromCloud, hasLocalData: hasLocal, nameOf: d => d.org.name })
   <CloudMenu sync={sync} app="goal" lang={lang} onNew={sync.mode === 'cloud' ? newWorkspace : null} />
   ```
   - `state` must be plain JSON and should leave out per-browser things (who "me" is, selection, zoom, open panels);
     `setState` receives the cloud copy and re-adds them.
   - Give list items stable unique `id`s so they merge instead of overwrite.
   - `newWorkspace`: `createWorkspace(app, prefix, blankState, name).then(openWorkspace)`.
5. Copy that says "stored in this browser only" must change when `sync.mode === 'cloud'`.

Behaviour: first visit uploads the local workspace (old local-only data is migrated, never deleted); `?w=<id>`
opens a shared workspace (if this browser had its own local data, that is uploaded first so it stays in the
switcher); edits are sent at most every 400 ms; unsent edits are queued in localStorage and survive reloads and
offline periods. Without `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` the app stays local-only (`sync.mode === 'local'`).

Limits (database): a workspace snapshot ≤ 1 MB, one change ≤ 64 KB. A single op over the limit is kept on this
device only and the menu says so (`sync.tooLarge`); big blobs such as images need their own handling.

## Testing

- Two real people: `set -a; . ../kit/.env.local; set +a; npx vite --port <port>` and two puppeteer browser
  contexts (`browser.createBrowserContext()`), each its own localStorage. Writes go to the production database, so
  keep test workspaces small and few.
- `VITE_BACKEND=mock` works within one browser profile only (localStorage + BroadcastChannel).
- `node` tests for patch.mjs: see the fuzz test in the session scratchpad; `diff`/`apply` must round-trip.
