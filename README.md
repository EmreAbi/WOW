# WOW

A blank React application built with Vite. Requires Node.js 24.12.0.

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

## Cloudflare Pages

- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: repository root
- Node.js version: `24.12.0` (set by `.node-version` and `.nvmrc`)

The repository contains no environment-specific credentials. Local environment
files, dependencies, build outputs, and Wrangler state are excluded from Git.
