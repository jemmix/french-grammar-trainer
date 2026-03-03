# Production Deployment Plan

## Current State

The app is ~60% complete. What works today:
- Full quiz experience (stateless)
- Binary progress tracking with EWMA (SQLite, dev-only)
- Client-side progress context with buffering/flushing
- Privacy, my-data, denied, goodbye pages (scaffolded, not wired to real auth)
- Dev-only fake login (returns 404 in production)

What's missing: real auth, cloud storage, allow-list enforcement, deployment config.

---

## Work Packages

### WP1: Google OAuth via next-auth

**What it does:** Replace dev fake-login with real Google sign-in.

**Code changes:**
- Install `next-auth`
- Create `src/pages/api/auth/[...nextauth].ts` with Google provider
- Wire Argon2id mangling into JWT/session callbacks (code already exists in `src/lib/auth.ts`, just needs a production salt from env)
- Update `src/contexts/progress-context.tsx` to use next-auth session instead of the `fgt-session` cookie
- Update all API routes to resolve userId from next-auth session
- Wire login/logout UI to next-auth `signIn()`/`signOut()`

**What I need from you:**
- A **Google Cloud OAuth client** (Web application type) for production
  - Authorized redirect URI: `https://<your-vercel-domain>/api/auth/callback/google`
  - Gives you: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- A second OAuth client for local dev (optional but recommended)
  - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
  - Or: reuse the same client and add both redirect URIs
- A random 32-byte secret for next-auth JWT signing: `NEXTAUTH_SECRET` (run `openssl rand -base64 32`)
- A random 32-byte secret for Argon2id salt: `HMAC_KEY` (run `openssl rand -hex 32`)

**Decision:** Do you want a separate Google Cloud project for dev vs prod, or one project with both redirect URIs?

---

### WP2: Allow-list (GitHub Gist)

**What it does:** Restrict login to approved users only.

**Code changes:**
- Build-time script fetches a GitHub Gist containing mangled user IDs (one per line)
- Writes to `src/lib/allow-list-data.ts` (gitignored)
- next-auth `signIn` callback checks `ALLOW_LIST.has(mangledId)`, redirects to `/denied` if not found
- `/denied` page shows the user's mangled ID so they can send it to you for whitelisting

**What I need from you:**
- Create a **GitHub Gist** (can be secret/unlisted) with a single file, e.g. `allowlist.txt`
- Give me the raw URL: `https://gist.githubusercontent.com/<you>/<gist-id>/raw/allowlist.txt`
- This becomes the `ALLOW_LIST_GIST_URL` env var

**Bootstrapping flow:**
1. Deploy with empty gist
2. Try to log in → get redirected to `/denied` → page shows your mangled ID
3. Add that ID to the gist
4. Redeploy (Vercel rebuilds, fetches updated gist)
5. Log in again → works

---

### WP3: Cloudflare R2 Storage

**What it does:** Replace SQLite with Cloudflare R2 for production user data storage.

**Code changes:**
- Install `@aws-sdk/client-s3`
- Create `src/lib/r2-store.ts` implementing the existing `UserStore` interface
- Add LZ4 compression (install `lz4js`) in the codec pipeline
- Environment-based store selection: SQLite in dev, R2 in prod

**Local testing with MinIO:**

MinIO is an S3-compatible object store that runs locally via Docker. Since R2 uses the S3 API and we use `@aws-sdk/client-s3`, the exact same code works against MinIO locally and R2 in production — just a different endpoint URL.

```bash
# Start MinIO (persists data in ./minio-data, gitignored)
docker run -d --name fgt-minio \
  -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  -v ./minio-data:/data \
  minio/minio server /data --console-address ":9001"

# Create the bucket (one-time, via MinIO web console at http://localhost:9001
# or via the mc CLI: mc alias set local http://localhost:9000 minioadmin minioadmin && mc mb local/fgt-users)
```

Local `.env.local` for MinIO:
```
R2_ENDPOINT=http://localhost:9000
R2_ACCESS_KEY_ID=minioadmin
R2_SECRET_ACCESS_KEY=minioadmin
R2_BUCKET_NAME=fgt-users
```

No `R2_ACCOUNT_ID` needed locally. The store code detects `localhost` or uses a flag to skip the Cloudflare-specific account ID prefix.

**What I need from you (for production):**
- A **Cloudflare account** (free tier is fine — R2 gives 10 GB free storage, 10M reads/month, 1M writes/month — we'll use a fraction of that)
- Create an **R2 bucket** (e.g. `fgt-users`)
- Create an **R2 API token** with read/write access to that bucket
- Gives you these env vars:
  - `R2_ACCOUNT_ID`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET_NAME`
  - `R2_ENDPOINT` (format: `https://<account-id>.r2.cloudflarestorage.com`)

**Cost estimate:** Even at 1000 users, total storage would be ~1 MB. Well within free tier forever.

---

### WP4: Vercel Deployment

**What it does:** Deploy the app to Vercel.

**Code changes:**
- Update `src/lib/env.ts` (currently missing — need to create with `@t3-oss/env-nextjs`) to validate all required env vars
- Add `vercel.json` if needed (likely not — defaults work for Next.js)
- Ensure `better-sqlite3` (native dep) is excluded from the production bundle / only loaded in dev
- Test that the build works on Vercel (Argon2id via hash-wasm is pure WASM, no native deps — should be fine)

**What I need from you:**
- A **Vercel account** (free Hobby tier works)
- Connect the GitHub repo to Vercel
- Set all env vars in Vercel project settings (see summary below)
- A **custom domain** if you want one (otherwise Vercel gives you `project-name.vercel.app`)

**Vercel settings to configure:**
- Framework: Next.js (auto-detected)
- Build command: `npm run build` (default)
- Node.js version: 20.x

---

## Full Env Var Summary

| Variable | Where to set | How to get it |
|----------|-------------|---------------|
| `GOOGLE_CLIENT_ID` | Vercel + `.env.local` | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_CLIENT_SECRET` | Vercel + `.env.local` | Same |
| `NEXTAUTH_SECRET` | Vercel + `.env.local` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Vercel only | Your production URL, e.g. `https://french-grammar.vercel.app` |
| `HMAC_KEY` | Vercel + `.env.local` | `openssl rand -hex 32` |
| `ALLOW_LIST_GIST_URL` | Vercel + `.env.local` | Raw URL of your GitHub Gist |
| `R2_ACCOUNT_ID` | Vercel only | Cloudflare dashboard (not needed locally) |
| `R2_ACCESS_KEY_ID` | Vercel + `.env.local` | Cloudflare R2 API token (locally: `minioadmin`) |
| `R2_SECRET_ACCESS_KEY` | Vercel + `.env.local` | Cloudflare R2 API token (locally: `minioadmin`) |
| `R2_BUCKET_NAME` | Vercel + `.env.local` | Whatever you named the bucket |
| `R2_ENDPOINT` | Vercel + `.env.local` | R2: `https://<account-id>.r2.cloudflarestorage.com`, local: `http://localhost:9000` |
| `NEXT_PUBLIC_LANG` | Vercel (optional) | `fr` (default) or `en` |

---

## Implementation Order

```
WP1 (Google OAuth)  ←  needs Google Cloud credentials
    ↓
WP2 (Allow-list)    ←  needs GitHub Gist URL
    ↓
WP3 (R2 Storage)    ←  needs Cloudflare credentials
    ↓
WP4 (Vercel Deploy) ←  needs Vercel account + all env vars above
```

WP1 and WP3 are independent — I can work on both in parallel. WP2 depends on WP1 (allow-list runs inside the next-auth callback). WP4 is the final integration step.

**What I can do right now without any credentials:**
- Scaffold all the code for WP1–WP3 with env var placeholders
- Write the env validation schema
- Create the R2 store implementation
- Wire next-auth into the existing pages
- Write the build-time gist fetch script
- **Fully test R2 storage locally** using MinIO (Docker) — no Cloudflare account needed

**What blocks deployment (but not local dev/testing):**
- You creating the Google OAuth client, Cloudflare R2 bucket, GitHub Gist, and Vercel project
- You providing the production env var values

---

## Do You Need a Separate Google OAuth Client for Local Dev?

The dev fake-login (`sub: "0"` with hardcoded salt) still works and exercises the full pipeline locally. You only need a real Google OAuth client for local dev if you want to test the actual Google sign-in flow on `localhost:3000`.

**Recommendation:** One Google Cloud project, one OAuth client with two redirect URIs (`localhost:3000` + production domain). Simpler to manage.

---

## Open Questions

1. **Custom domain?** Do you have one, or is `*.vercel.app` fine for now?
2. **Who else needs access?** Just you initially, or should the allow-list have other users from day one?
3. **Preview deployments:** Vercel creates preview URLs for every PR. Should those have auth too, or is the allow-list sufficient since only you know the mangled IDs?
