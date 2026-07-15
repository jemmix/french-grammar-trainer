# src/app — Next.js App Router

This directory is **hardcoded by Next.js**. The framework requires it to be at
exactly `./app/` (project root) or `./src/app/`. There is no config option to
relocate it.

It contains only **routing files** (`page.tsx`, `layout.tsx`, `route.ts`,
`loading.tsx`, etc.) and co-located route helpers.

Webapp support code (components, contexts, themes, lib, styles, env) lives in
[`src/next/`](../next/).

**On framework migration** (e.g. SvelteKit): delete this directory and
`src/middleware.ts`, then create the new framework's routing structure
(SvelteKit uses `src/routes/`). The domain directories (`src/auth/`,
`src/config/`, `src/content/`, etc.) are framework-agnostic and port unchanged.
