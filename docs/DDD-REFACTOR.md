# DDD Refactor — Progress Tracker

Goal: separate framework-agnostic domains from the webapp layer (behavior-preserving refactor, pre-SvelteKit-swap).
Resume: do the first ☐ step. Every prior step is a green commit.

## Steps (dependency order)
- [x] 0. scaffold tracker
- [x] 1. `config/` — env seam + lang-config + theme resolver
- [x] 2. `lang/` — i18n
- [x] 3. `auth/` — identity crypto
- [ ] 4. `content/` — model + parse + sections + extract `find`/`slots`
- [ ] 5. `mastery/` — UserProgress model + math
- [ ] 6. `storage/` — serialize/deserialize + engines (needs 5)
- [ ] 7. `quiz/` — select + grade + extract interstitial + split blanks (needs 4,5)
- [ ] 8. `validation/` — verify purity
- [ ] 9. lint hard-error rule + cleanup

## Gates (every step before commit)
`npm run typecheck` && `npm test` && `npm run dev` smoke (home loads, answer one quiz Q)

## Per-step log
| step | commit | status | notes |
|------|--------|--------|-------|
| 0 | _pending_ | ☐ | tracker scaffold |
| 1 | _pending_ | ✅ | config: env.ts (lone process.env reader), lang-config.ts, theme.ts (resolveTheme extracted from themes) |
| 2 | _pending_ | ✅ | lang: moved elision-check → lang/elision.ts (index already on config/env) |
| 3 | _pending_ | ✅ | auth: mangle/session-cookie/allow-list moved; ALLOW_LIST_DEV_MODE via config/env; generator script + .gitignore repointed |
| 4 | _pending_ | ☐ | content domain |
| 5 | _pending_ | ☐ | mastery domain |
| 6 | _pending_ | ☐ | storage domain |
| 7 | _pending_ | ☐ | quiz domain |
| 8 | _pending_ | ☐ | validation domain |
| 9 | _pending_ | ☐ | lint rule + cleanup |

## Locked decisions
- Naming: `UserProgress` (whole user data), `ProgressHeader` (metadata envelope), `mastery/progress.ts`.
- `mastery/` = in-memory model + math ONLY (no bytes/I/O). `storage/` owns all serialization.
- `storage/store.ts` = `UserStore` iface + `getStore` + `serialize`/`deserialize` (binary codec + lz4 **inline**, no separate compression file); `storage/engines/{s3,sqlite}.ts`.
- Extractions in-flow: `find`, `slots` (step 4); interstitial selector (step 7); `blanks` JSX split (step 7).
- `themes/`: pure `resolveTheme` → `config/theme.ts`; React components stay (webapp).
- `src/lib/` shrinks to `server-session.ts` + `auth-config.ts` (NOT deleted).
- Lint `no-restricted-imports` HARD ERROR on domain dirs (added last, step 9).
- One commit per domain (code + this checkbox flip together).
