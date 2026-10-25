# Lift Apps by AIYun

Static family site for Lift Apps (lift.aiyun.com.au). No build step.

- `apps.js`: the catalogue. Change an app's `status` (`live` / `building` / `planned`) and add `url` when it goes live.
- `index.html`, `styles.css`, `main.js`: page, light AIYun theme, rendering.
- `assets/aiyun-mark.png`: official AIYun watermark for light backgrounds (raster; never redraw).

Local preview: `python3 -m http.server 4180 --bind 127.0.0.1` then open http://localhost:4180.
Hosting: GitHub Pages from `main`, custom domain in `CNAME`.
