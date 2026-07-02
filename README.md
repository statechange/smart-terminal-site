# Smart Terminal — marketing site

Landing + download page for [Smart Terminal](https://github.com/rhdeck/smart-terminal),
a Tauri + Rust + React SSH terminal with native tmux control-mode
integration. A gift from [State Change](https://statechange.ai).

Static site, built with [Astro](https://astro.build). No backend, no CMS.

## Structure

```
src/
  pages/index.astro          # the single landing page
  layouts/Base.astro         # <html> shell, fonts, scroll-reveal wiring
  components/                # Hero, HeadlineFeatures, ScreenshotShowcase,
                              # MockupPanels, SecondaryFeatures, GiftSection, Footer
  lib/release.ts             # typed accessor for the fetched release info
  styles/global.css          # "Warm Woody" palette (exact hex from the app)
scripts/fetch-release.mjs    # build-time fetch of the STABLE release manifest
public/screenshots/          # one real app screenshot (connect screen)
```

## Release version / download link

The version number and DMG link are **fetched at build time** from the
stable release manifest:

```
https://smart-terminal-releases.nyc3.digitaloceanspaces.com/latest.json
```

`npm run build` and `npm run dev` both run `scripts/fetch-release.mjs`
first (see the `prebuild` / `predev` npm scripts), which writes
`src/generated/release.json` (gitignored, regenerated every run). If the
fetch fails for any reason, the script falls back to a hardcoded version —
see `FALLBACK` in `scripts/fetch-release.mjs` to bump it manually if the
bucket/manifest URL ever changes.

Never point this at a canary/dev channel manifest — stable only.

## Commands

| Command           | Action                                    |
| ------------------ | ------------------------------------------ |
| `npm install`      | Install dependencies                        |
| `npm run dev`      | Local dev server                            |
| `npm run build`    | Fetch release info + build to `./dist/`     |
| `npm run preview`  | Preview the production build locally        |

## Deploy

Deployed to Netlify (`terminal.statechange.ai`), connected to this repo for
continuous deploy on push to `main`. Build command `npm run build`, publish
directory `dist`.
