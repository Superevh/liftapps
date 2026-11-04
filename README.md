# Lift Apps by AIYun

https://liftapps.com.au: a family of nine light tools covering the delivery cycle.
RetroLift runs on fun-retro.com; the other apps are hosted here under `/<key>/app/`.

## Free resources for agile teams

Guides that go with the apps, all free and without sign-up:

- [Retrospective templates](https://fun-retro.com/templates/): Sailboat, Start Stop Continue, 4Ls, Mad Sad Glad and more, each opening as a live board ([中文](https://fun-retro.com/zh/templates/))
- [72 retrospective questions](https://fun-retro.com/retrospective-questions/), grouped by part of the retro ([中文](https://fun-retro.com/zh/retrospective-questions/))
- [Retrospective games](https://fun-retro.com/retrospective-games/) and [team games](https://fun-retro.com/games/) that run in the browser
- [Icebreaker questions](https://fun-retro.com/icebreaker-questions/) and [free agile tools](https://fun-retro.com/tools/) such as planning poker and a Monte Carlo forecast
- [Practical AI guides for agile teams](https://aiyun.com.au/guides/) by AIYUN

## Code

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
