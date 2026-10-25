# Lift Apps by AIYun

https://liftapps.com.au: a family of nine light tools covering the delivery cycle.
RetroLift runs on fun-retro.com; the other apps are hosted here under `/<key>/app/`.

| Folder | What it is |
|---|---|
| `shared/catalog.mjs` | The lineup (names, status, links, EN/中文 copy). Edit this first. |
| `shared/icons.mjs` | Illustrated app icons. |
| `shared/lift-shell.mjs`, `shared/lift-theme.css` | `<lift-bar>` top bar (app switcher, EN/中文) and theme tokens used by every app. |
| `site/` | Static assets for the marketing site (styles, fonts, logo, share images). |
| `tools/build-site.mjs` | Pre-renders the site: `/` English, `/zh/` Chinese, one page per app, 404, sitemap, robots, redirects. |
| `tools/make-og.mjs` | Re-renders share images with local Chrome after copy changes. |
| `apps/*` | One Vite app per folder (`kit` holds EstimateLift, MeetingLift and PulseLift). |
| `tools/build-all.mjs` | Builds the site and every app into `dist/`. |

```bash
node tools/build-all.mjs                                      # full build into dist/
cd dist && python3 -m http.server 4180 --bind 127.0.0.1       # preview at http://localhost:4180
```

Deploy: push to `main`. GitHub Actions (`.github/workflows/pages.yml`) builds and publishes to GitHub Pages.
Supabase settings come from repository secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; never commit `.env*` files.
