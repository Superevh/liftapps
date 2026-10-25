# Lift Apps by AIYun

Static family site for Lift Apps (https://liftapps.com.au). No build step.

- `apps.js`: the catalogue. Change an app's `status` (`live` / `building` / `planned`) and add `url` when it goes live.
- `details.js`: intro-page content (tagline, features, related apps) for apps that are not live.
- `node tools/make-pages.mjs`: regenerates `/<key>/index.html` intro pages after adding an app or making one live (live apps link straight to their URL and get no intro page).
- `index.html`, `main.js`: home page. `app.js`: intro page. `i18n.js`: EN/中文 strings. `icons.js`: illustrated app icons. `styles.css`: light AIYun theme.
- `assets/aiyun-mark.png`: official AIYun watermark for light backgrounds (raster; never redraw).

Local preview: `python3 -m http.server 4180 --bind 127.0.0.1` then open http://localhost:4180.
Hosting: GitHub Pages from `main`, custom domain in `CNAME`.
