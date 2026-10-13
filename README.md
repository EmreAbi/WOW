# WOW

A Turkish World of Warcraft history atlas built with React, Vite, Three.js and Motion. Requires Node.js 24.12.0.

Live site: https://wow-5x7.pages.dev

```sh
npm ci
npm run dev
```

## Production build

```sh
npm run lint
npm run build
npm run preview
```

The production files are generated in `dist/`.

## The atlas

- 327 pages across 17 chapters, with all original text, 45 tables and 405 source icons.
- Interactive era timeline, searchable reader, chapter navigation, page deep links and reading progress.
- Cinematic artwork and a lazy-loaded Three.js atmosphere, with reduced-motion support.
- Responsive layouts and semantic keyboard-accessible controls.

The supplied presentation is the editorial source. Its wording, date claims and caveats are preserved; the site is an adaptation, not an independent fact-check. See `docs/source-content-audit.md` for coverage and `docs/visual-assets.md` for illustration provenance.

Content credit: **Gaddar - Huntart FTW**.

To independently compare the extracted atlas to the original presentation:

```sh
npm run verify:content -- /path/to/WoW_Retail_Hikaye_Atlasi.pptx
```

## Cloudflare Pages

- Project: `wow`, connected to `EmreAbi/WOW` with automatic deployments
- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: repository root
- Node.js version: `24.12.0` (set by `.node-version` and `.nvmrc`)

The repository contains no environment-specific credentials. Local environment
files, dependencies, build outputs, and Wrangler state are excluded from Git.
