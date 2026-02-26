# Stateful Progress Tracking — Design & Implementation Plan

## Overview

Transform the French Grammar Trainer from a stateless quiz app into a stateful learning system with progress tracking, adaptive question selection, and guided learning. The app must remain fully usable without logging in (stateless mode). For logged-in users: storage is K/V (mangledUserId → compressed binary blob), auth is next-auth/Google in production with a privacy-first approach.

---

## 1. Data Model

### 1.1 User Record (binary blob)

All user state is packed into a single binary blob. Dense layout: fixed-size slots for all 560 rules (28 sections × 20 rules).

```
┌─────────────────────────────────────────────┐
│ Header (11 bytes)                           │
│   version:      uint8    (1)  — schema v.   │
│   createdAt:    uint32   (4)  — unix secs   │
│   lastActiveAt: uint32   (4)  — unix secs   │
│   ruleSlots:    uint16   (2)  — always 560  │
├─────────────────────────────────────────────┤
│ Rule Slots (3 bytes × 560 = 1680 bytes)     │
│   power:          uint16 (2)  — EWMA×65535  │
│   answeredCount:  uint8  (1)  — 0-255       │
└─────────────────────────────────────────────┘

Uncompressed total: 11 + 1680 = 1691 bytes ≈ 1.7 KB
```

**Slot index** is computed directly from rule ID: `(sectionIdx × 20) + ruleIdx`. Unattempted rules are all-zeros.

### 1.2 Rule Slot Fields

| Field | Size | Description |
|-------|------|-------------|
| `power` | uint16 | Cumulative EWMA of correctness, scaled to 0–65535. `stored / 65535` gives a float in [0, 1]. |
| `answeredCount` | uint8 | Lifetime attempts, capped at 255. Used for confidence ramp and display ("pratiqué 42 fois"). |

No bitmask, no timestamps per rule. The EWMA is cumulative — each new answer updates the running value without needing history.

### 1.3 Recording an Answer

```typescript
function recordAnswer(slot: RuleSlot, correct: boolean): void {
  const DECAY = 0.88;
  const MAX_POWER = 65535;

  // EWMA update: newPower = oldPower × decay + result × (1 - decay)
  const oldPower = slot.power / MAX_POWER;
  const newPower = oldPower * DECAY + (correct ? 1 : 0) * (1 - DECAY);
  slot.power = Math.round(newPower * MAX_POWER);
  slot.answeredCount = Math.min(255, slot.answeredCount + 1);
}
```

**EWMA convergence with decay = 0.88:**

| Streak of correct answers | Raw power | With confidence ramp (§2.1) |
|---------------------------|-----------|---------------------------|
| 5 | 0.472 | 0.236 |
| 10 | 0.721 | 0.721 |
| 15 | 0.856 | 0.856 |
| 20 | 0.929 | 0.929 |
| 25 | 0.965 | 0.965 (mastered) |

Formula: `P(n) = 1 − 0.88^n` for all-correct from zero.

**Recovery from a slump** (10 correct after reaching power=0.3):

| Answer # | Power |
|-----------|-------|
| Start | 0.300 |
| +5 correct | 0.618 |
| +10 correct | 0.800 |
| +15 correct | 0.898 |
| +20 correct | 0.945 |

The EWMA naturally blends old performance with new, giving recency bias (each old answer's influence decays by 12% per new answer) while still reflecting cumulative learning.

### 1.4 Compression

The 1691-byte blob is compressed with **LZ4** before storage. LZ4 is chosen for:
- Very fast decompression (~4 GB/s) — important for page loads
- Reasonable compression on small data
- Available as `lz4js` (pure JS, ~5 KB gzipped) — no native deps

**Estimated compressed sizes:**

| User state | Uncompressed | LZ4 compressed (est.) |
|------------|-------------|----------------------|
| Brand new (all zeros) | 1691 B | ~30–50 B |
| 50 rules attempted | 1691 B | ~200–400 B |
| All 560 rules active | 1691 B | ~800–1200 B |

LZ4 excels at the common case (mostly zeros). Even the worst case stays under 1.5 KB. If we ever need to migrate to a storage backend sensitive to object size, the data is already negligible.

---

## 2. Power Level Computation

### 2.1 Display Power (with confidence ramp)

The stored EWMA is the "raw" power. For display and question-picker purposes, we apply a confidence ramp to prevent premature tier labels:

```typescript
function getDisplayPower(slot: RuleSlot): number {
  if (slot.answeredCount === 0) return 0;
  const rawPower = slot.power / 65535;
  const confidence = Math.min(1, slot.answeredCount / 10);
  return rawPower * confidence;
}
```

This means a learner who got 2/2 correct has displayPower ≈ 0.22 × 0.2 = 0.044 — solidly "Débutant", not "mastered".

### 2.2 Per-Section Power Level

```
sectionPower = mean(displayPower(rule) for rule in section.rules if answeredCount > 0)
```

If no rules attempted: section is "not started" (distinct from zero power).

### 2.3 Global Power Level

```
globalPower = mean(displayPower(rule) for all rules if answeredCount > 0)
```

### 2.4 Display Tiers (Opaque)

Power levels are **never shown as numbers**. Users see only tier labels, progress rings, and promotion messages. The internal power value stays opaque.

| Threshold | Tier label | Ring color | Promotion message |
|-----------|-----------|------------|-------------------|
| Not started | — | `slate-400` (muted) | — |
| 0.00–0.20 | Débutant | `sky-400` | « Première étape franchie ! » |
| 0.20–0.40 | En progrès | `teal-400` | « Vous progressez, continuez ! » |
| 0.40–0.60 | Intermédiaire | `amber-400` | « Niveau intermédiaire atteint ! » |
| 0.60–0.80 | Avancé | `orange-400` | « Vous devenez solide ! » |
| 0.80–0.95 | Très avancé | `emerald-400` | « La maîtrise approche ! » |
| 0.95–1.00 | Maîtrisé ! | `yellow-400` (gold) | « Bravo, vous maîtrisez ce sujet ! » |

**Promotion events:** When a rule or section crosses a tier boundary upward, display a brief toast/banner with the promotion message. Only fire on upward transitions (never demote loudly — if a user drops a tier, silently update the ring color but don't announce it).

The progress ring is an SVG `<circle>` with `stroke-dasharray` proportional to display power. Ring color transitions smoothly via CSS.

---

## 3. Storage Layer

### 3.1 Interface

```typescript
interface UserStore {
  get(userId: string): Promise<Uint8Array | null>;   // compressed blob
  put(userId: string, data: Uint8Array): Promise<void>;
  delete(userId: string): Promise<void>;              // for account removal
}
```

The store handles raw compressed bytes. Encode/decode and compress/decompress happen in a separate codec layer.

### 3.2 SQLite Implementation (Dev)

`better-sqlite3` — synchronous, zero-config. Single table:

```sql
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  data BLOB NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

DB file at `data/dev.sqlite3` (gitignored). Auto-created on first request.

### 3.3 R2 Implementation (Prod)

Cloudflare R2 via S3 API (`@aws-sdk/client-s3`):

```
Bucket: french-grammar-trainer-users
Key:    users/{mangledUserId}
Value:  LZ4-compressed blob (typically <1 KB)
```

### 3.4 Codec Pipeline

```
UserRecord (in-memory)
  ↕ encode/decode (binary, 1691 bytes)
  ↕ compress/decompress (LZ4, ~50–1200 bytes)
  ↕ store get/put (raw bytes)
```

The codec includes version checking. On version mismatch, a migration function converts old → new, zero-filling new fields.

---

## 4. API Routes

### 4.1 `GET /api/progress`

Returns the user's progress decoded to JSON. Returns `204 No Content` for new users. Returns `401` for unauthenticated requests.

### 4.2 `POST /api/progress`

Accepts a batch of answer results:

```typescript
// Request:
{ answers: Array<{ ruleId: string; correct: boolean }> }
// Response:
{ ok: true }
```

Reads current blob, applies answers sequentially via `recordAnswer()`, writes back. Last-write-wins (no concurrent multi-device).

### 4.3 `DELETE /api/progress`

Account removal. Deletes the K/V entry entirely. Returns `200 { ok: true }`. Requires authenticated session.

### 4.4 `GET /api/progress/export`

Returns the user's full record as pretty-printed JSON for data takeout. Described in §10.

### 4.5 User ID Resolution

```typescript
function resolveUserId(req: NextApiRequest): string | null {
  if (!hasSession(req)) return null;  // logged-out → null (stateless mode)
  // Dev fake-login or prod next-auth session:
  return session.mangledUserId;
}
```

---

## 5. Auth & Privacy

### 5.1 User ID Mangling

**Algorithm: Argon2id** — memory-hard, GPU/ASIC-resistant. Parameters:

```typescript
import { argon2id } from 'hash-wasm';

async function mangleUserId(googleSubId: string): Promise<string> {
  return argon2id({
    password: googleSubId,
    salt: HMAC_KEY,           // env var, 32 bytes random
    parallelism: 1,
    iterations: 3,
    memorySize: 65536,        // 64 MB
    hashLength: 32,
    outputType: 'hex',
  });
  // Returns 64-char hex string
}
```

**Why Argon2id:**
- Memory-hard: 64 MB per hash makes GPU/ASIC attacks extremely expensive
- ~200–500 ms per computation on a single core — acceptable for login
- HMAC-style keying via the salt (which is actually a secret key here) prevents offline brute-force even if the hash output leaks
- Google `sub` IDs are numeric (~21 digits), but the 64 MB memory cost makes enumeration infeasible

**Vercel free tier feasibility:**
- 1000 logins/month × 0.4s × 64 MB ≈ 0.007 GB-hrs — negligible vs 100 GB-hrs limit
- Stays well within 10s function timeout

**Implementation:** Use `hash-wasm` (pure WebAssembly, no native deps, works on all Vercel runtimes).

### 5.2 Dev Mode Auth

Dev mode supports **both** logged-in and logged-out states:

- **Logged out (default):** App works in fully stateless mode, identical to current behavior. No progress is tracked or stored.
- **Logged in (fake):** A dev-only "Se connecter (dev)" button triggers a fake login flow. It pretends Google returned `sub: "0"`, mangles it with Argon2id (using a hardcoded dev salt), and uses the result as the K/V key. This exercises the full auth + storage pipeline locally.

### 5.3 Production Auth: next-auth with Google

```typescript
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ account }) {
      // Allow-list check (§5.5)
      const mangledId = await mangleUserId(account!.providerAccountId);
      const allowed = await checkAllowList(mangledId);
      if (!allowed) return '/denied';  // redirect to denied page
      return true;
    },
    async jwt({ token, account }) {
      if (account) {
        token.mangledUserId = await mangleUserId(account.providerAccountId);
      }
      return token;
    },
    async session({ session, token }) {
      session.mangledUserId = token.mangledUserId as string;
      return session;
    },
  },
  session: { strategy: 'jwt' },
};
```

### 5.4 Privacy Policy

**Interstitial:** Before redirecting to Google OAuth, show a privacy interstitial that explains:

1. We don't store your email, name, or any personally identifiable information
2. We derive an irreversible identifier from your Google account — we cannot trace it back to you
3. We store only cumulative progress data: per-rule power level (a single number) and attempt count for each grammar rule
4. Total stored data: under 2 KB
5. A stateless mode is available if you prefer not to store any data with us
6. A single cookie (`privacy-acknowledged`) remembers your acknowledgment so you won't see this again

**Checkbox:** "Ne plus afficher ce message" — sets a `privacy-acknowledged` cookie (HttpOnly=false, SameSite=Lax, max-age=10 years). The cookie itself is mentioned in the policy text.

**Footer link:** The same privacy text is available as a standalone page (`/privacy`) linked from the site footer, so it's always accessible. The page version also mentions:
- The `privacy-acknowledged` cookie and its purpose
- That a fully stateless mode (no login, no data stored) is always available
- How to request data takeout or account removal (link to `/my-data`)

### 5.5 Allow List

Access is restricted to approved users. The allow list is a text file hosted as a **GitHub Gist**, one mangled userId per line, pulled at **build time** (not runtime).

```
# Env var (available at build time)
ALLOW_LIST_GIST_URL=https://gist.githubusercontent.com/.../allowlist.txt
```

**Build step:** `next.config.js` (or a prebuild script) fetches the gist and writes it to a module:

```typescript
// Generated at build time → src/lib/allow-list-data.ts (gitignored)
export const ALLOW_LIST: ReadonlySet<string> = new Set([
  "a1b2c3d4...",
  "e5f6g7h8...",
]);
```

**Runtime flow:**
1. User completes Google OAuth
2. `signIn` callback mangles the Google `sub` → `mangledId`
3. Check `ALLOW_LIST.has(mangledId)` — pure in-memory lookup, no network call
4. If in the set → allow login
5. If not → redirect to `/denied`

**Denied page** (`/denied`): A friendly message explaining that access is currently limited, with instructions to contact the developers (e.g., email or GitHub issue link) to request access. Include the mangled userId so the user can include it in their request (it's not PII — it can't be reversed).

**Adding a user to the allow list:**
1. User sends their mangled ID (shown on the denied page)
2. Dev adds it to the gist
3. Redeploy (Vercel rebuilds, fetches updated gist, regenerates the set)

### 5.6 Stateless Mode

The app is **fully functional without logging in.** Stateless mode is the default state:
- All quiz functionality works identically to the current app
- No progress is tracked, no data is stored, no cookies are set (except the optional privacy-acknowledged cookie)
- The smart question picker (§7) falls back to uniform random selection
- Section cards show no progress rings
- The "Apprendre librement" button still works but uses uniform weighting

The login button is always visible (as a subtle link, not a prominent CTA) for users who want to opt into progress tracking.

---

## 6. Client-Side State Management

### 6.1 Progress Context

```typescript
interface ProgressContextValue {
  isLoggedIn: boolean;
  isLoading: boolean;
  // These return 0 and behave as no-ops when logged out:
  recordAnswer: (ruleId: string, correct: boolean) => void;
  getRulePower: (ruleId: string) => number;
  getSectionPower: (sectionId: string) => number;
  getGlobalPower: () => number;
  getRuleAnswerCount: (ruleId: string) => number;
  flush: () => Promise<void>;
}
```

When logged out, `getRulePower` etc. return 0 and `recordAnswer` is a no-op. Components don't need to check login state — they just render based on the values (all zeros = no progress shown).

### 6.2 Answer Buffering

Answers are applied to the local `UserRecord` immediately and queued for server sync. Flush triggers:
1. End of quiz (score summary screen)
2. Every 30 seconds (if pending answers exist)
3. `beforeunload` (best-effort via `navigator.sendBeacon`)

### 6.3 Initialization Flow

```
App mount
  → Check next-auth session (or dev fake session)
  → If logged in:
      → GET /api/progress
      → If 204: create empty local UserRecord
      → Populate context
  → If logged out:
      → Context stays empty (all zeros)
      → App renders in stateless mode
```

---

## 7. Smart Question Picker

### 7.1 Rule Ranking

Each rule gets a **selection weight** inversely proportional to its display power:

```
weight(rule) = (1 - displayPower(rule))² + 0.05
```

- Squaring amplifies preference for weak rules
- `+0.05` floor ensures mastered rules still appear occasionally
- Unattempted rules (answeredCount = 0): weight = `0.50`

**Stateless fallback:** When not logged in, all weights are equal → uniform random selection (current behavior).

### 7.2 Weighted Random Selection

```typescript
function weightedRandomPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}
```

### 7.3 Section Quiz Mode (Enhanced)

The existing 20-question section quiz becomes power-aware:

1. Group section questions by rule
2. Compute selection weight per rule (§7.1)
3. For each of the 20 slots: pick a rule via weighted random, then pick a random question from it (no repeats within the quiz)
4. Shuffle the final 20

Falls back to uniform random when logged out.

### 7.4 "Apprendre librement" Mode

Accessible from the home page. Selects 20 questions:

```
BUDGET ALLOCATION (20 questions total):
  Focus rule:              9
  Encouragement (focus):   1   ← from a strong rule, blended in
  Adjacent rules:          4
  Encouragement (adjacent):1   ← from a strong rule in same section
  Left-field rules:        4
  Encouragement (l-field): 1   ← from a strong rule elsewhere
                          ──
                          20
```

**Algorithm:**

1. **Select focus section:** Weighted random from sections by inverse section power. Exclude sections with no content.

2. **Select focus rule:** Weighted random from focus section's rules (§7.1).

3. **Pick 9 focus questions:** Random from the focus rule. If fewer than 9 available, supplement from other weak rules in the same section.

4. **Pick 1 encouragement (focus batch):** Highest-power rule in the focus section with displayPower > 0.6 (or any attempted rule). Shuffled in — learner doesn't know.

5. **Pick 4 adjacent questions:** From rules ±1, ±2 positions from focus rule in ToC order. Weighted random.

6. **Pick 1 encouragement (adjacent):** Different strong rule from the focus section.

7. **Pick 4 left-field questions:** From 2–3 random non-focus sections, biased toward weaker ones.

8. **Pick 1 encouragement (left-field):** Strong rule from a non-focus section.

9. **Shuffle all 20** (Fisher-Yates).

**When logged out:** All weights are equal, so this becomes "pick 20 random questions from across all sections" — still useful as a cross-section review mode.

### 7.5 Edge Cases

| Scenario | Behavior |
|----------|----------|
| New user (no history) | All weights equal (0.50). Uniform spread. |
| Only one section attempted | Left-field draws from the same section's weaker rules. |
| Rule has <5 questions | Supplement from adjacent rules. |
| All rules mastered | Weights ≈ 0.05 each. Uniform "review everything" mode. |
| No time decay | Power levels don't decay with absence. We don't penalize breaks. |

---

## 8. UI Changes

### 8.1 Home Page — Section Cards (Logged In)

Each section card gains:
- A **progress ring** (SVG circle) showing section tier color and fill
- The **tier label** below the ring (e.g., "Intermédiaire")
- No numeric power level shown — purely opaque

Cards for unattempted sections show a muted empty ring.

### 8.2 Home Page — Section Cards (Logged Out)

Identical to current design. No progress rings, no tier labels. Clean and simple.

### 8.3 Home Page — Global Progress Banner (Logged In)

Top of page:
- Large progress ring with global tier label
- Encouraging message varying by tier
- Shows promotion toasts when tier boundaries are crossed

### 8.4 Home Page — "Apprendre librement" Button

Prominent CTA above the section grid. Works for both logged-in and logged-out users:
- Logged in: "20 questions adaptées à votre niveau"
- Logged out: "20 questions de tous les sujets"

### 8.5 Quiz Page — Score Summary Enhancements (Logged In)

At quiz end, show:
- Per-rule tier changes (only when a promotion happened): "Les articles définis : Intermédiaire → Avancé"
- Section-level promotion if applicable
- Supportive message

### 8.6 Login/Logout UI

- **Logged out:** Subtle "Se connecter" link in the header/footer area. Not a prominent CTA — the app should feel complete without it.
- **Logged in:** Small indicator (colored dot derived from hash, or just "Connecté") with a dropdown offering "Mes données", "Se déconnecter".
- **Dev mode:** "Se connecter (dev)" button that runs the fake auth flow.

### 8.7 Design Principles

- Use the `frontend-design` skill for all UI implementation
- Progress indicators: warm, encouraging, never punitive
- Smooth animations on ring fill and tier transitions
- Silent demotions (ring color updates quietly, no announcement)
- Mobile-first: rings and labels work on small screens
- The app must feel equally polished in stateless mode — not a degraded experience

---

## 9. "Mes données" Page (My Data)

A page at `/my-data` (accessible only when logged in) showing:

### 9.1 Identity

- Full mangled userId displayed (it's not PII — safe to show)
- Explanation: "Cet identifiant est dérivé de votre compte Google de manière irréversible. Il ne permet pas de vous identifier."

### 9.2 Data Takeout

- All progress data displayed in a readable format:
  - Per-section summary: tier label, number of rules attempted, total answers
  - Per-rule detail: tier label, answer count
- **"Télécharger mes données (JSON)"** button → triggers download of a pretty-printed JSON file containing:
  ```json
  {
    "exportedAt": "2026-02-26T...",
    "userId": "a1b2c3...",
    "format": "french-grammar-trainer-export-v1",
    "globalTier": "Intermédiaire",
    "sections": [
      {
        "id": "01-present-indicatif",
        "title": "Le présent de l'indicatif",
        "tier": "Avancé",
        "rules": [
          {
            "id": "01-01",
            "title": "...",
            "tier": "Maîtrisé !",
            "answeredCount": 47,
            "powerLevel": 0.97
          }
        ]
      }
    ]
  }
  ```
  (Power level is included in the export for completeness even though it's hidden in the UI.)

### 9.3 Account Removal

- **"Supprimer mon compte"** button
- Triggers a confirmation dialog: "Cette action est irréversible. Toutes vos données de progression seront supprimées."
- On confirm: `DELETE /api/progress` → K/V entry removed
- Redirects to a logged-out page with message: "Vos données seront supprimées sous peu. Vous êtes toujours le bienvenu !"
- Session is destroyed (next-auth signOut)

---

## 10. Implementation Phases

### Phase 1: Core Data Layer
1. Define `UserRecord` types and `RuleSlot` interface
2. Implement binary codec (encode/decode/createEmpty)
3. Implement LZ4 compress/decompress wrapper
4. Implement `computeDisplayPower`, `getSectionPower`, `getGlobalPower`
5. Implement `UserStore` interface + `SqliteUserStore`
6. Create API routes (`GET/POST/DELETE /api/progress`, `GET /api/progress/export`)
7. Add dependencies: `better-sqlite3`, `lz4js`

### Phase 2: Client-Side Progress
1. Create `ProgressContext` and `ProgressProvider`
2. Wire up answer recording in quiz page
3. Implement answer buffering and server sync
4. Add `beforeunload` flush with `sendBeacon`
5. Test round-trip: answer → local update → server write → reload → persists

### Phase 3: Progress UI
1. Build progress ring SVG component
2. Add tier labels and promotion toast system
3. Add power display to section cards (home page, logged-in only)
4. Add global progress banner
5. Add per-rule tier changes to quiz score summary
6. Use `frontend-design` skill for polished design

### Phase 4: Smart Question Picker
1. Extract picker into `src/lib/question-picker.ts`
2. Implement weighted rule selection (§7.1, §7.2)
3. Enhance section quiz with power-aware weighting (§7.3)
4. Implement "Apprendre librement" mode (§7.4)
5. Add the button and route
6. Test edge cases (new user, all mastered, logged out)

### Phase 5: Auth & Privacy
1. Add `next-auth` with Google provider
2. Implement Argon2id mangling with `hash-wasm`
3. Build privacy policy interstitial + `/privacy` page
4. Implement allow list (build-time gist fetch → generated module)
5. Build `/denied` page
6. Add dev fake-login flow
7. Add login/logout UI
8. Compose privacy policy text

### Phase 6: My Data & Account Management
1. Build `/my-data` page
2. Implement data takeout (formatted display + JSON download)
3. Implement account removal flow
4. Add `DELETE /api/progress` endpoint
5. Wire up post-deletion redirect

### Phase 7: Production Storage
1. Implement `R2UserStore` with `@aws-sdk/client-s3`
2. Environment-based store selection (SQLite vs R2)
3. Test full production flow
4. Deploy and verify

---

## 11. File Structure (New/Modified)

```
src/
├── lib/
│   ├── user-record.ts        # Types, binary codec, LZ4 wrapper, power computation
│   ├── user-store.ts          # UserStore interface
│   ├── sqlite-store.ts        # SQLite implementation
│   ├── r2-store.ts            # R2/S3 implementation (Phase 7)
│   ├── question-picker.ts     # Smart question selection algorithms
│   ├── auth.ts                # next-auth config, Argon2id mangling (Phase 5)
│   ├── allow-list-data.ts     # Build-generated allow list set (gitignored) (Phase 5)
│   └── constants.ts           # All tunables (§12)
├── contexts/
│   └── progress-context.tsx   # ProgressContext + ProgressProvider
├── components/
│   ├── progress-ring.tsx      # SVG progress ring
│   ├── tier-label.tsx         # Tier label + color
│   ├── promotion-toast.tsx    # Tier-up celebration toast
│   └── global-progress.tsx    # Global progress banner
├── pages/
│   ├── api/
│   │   ├── progress.ts        # GET/POST/DELETE progress
│   │   ├── progress/
│   │   │   └── export.ts      # GET data takeout
│   │   └── auth/
│   │       └── [...nextauth].ts
│   ├── index.tsx              # Modified: progress rings, banner, learn button
│   ├── quiz/
│   │   ├── [sectionId].tsx    # Modified: record answers, show tier changes
│   │   └── learn.tsx          # "Apprendre librement" quiz page
│   ├── privacy.tsx            # Privacy policy page
│   ├── denied.tsx             # Access denied page
│   ├── my-data.tsx            # Data takeout & account removal
│   └── _app.tsx               # Modified: wrap with ProgressProvider
data/
│   └── dev.sqlite3            # gitignored
```

---

## 12. Dependencies to Add

| Package | Purpose | Phase |
|---------|---------|-------|
| `better-sqlite3` | SQLite for dev storage | 1 |
| `@types/better-sqlite3` | TypeScript types | 1 |
| `lz4js` | LZ4 compression (pure JS) | 1 |
| `next-auth` | Auth framework | 5 |
| `hash-wasm` | Argon2id (pure WASM, no native deps) | 5 |
| `@aws-sdk/client-s3` | R2 access via S3 API | 7 |

---

## 13. Constants & Tunables

```typescript
// src/lib/constants.ts
export const PROGRESS = {
  // EWMA
  DECAY_FACTOR: 0.88,           // Per-answer decay (12% recency bias)
  CONFIDENCE_RAMP: 10,          // Answers needed for full confidence
  MASTERY_THRESHOLD: 0.95,      // Display power considered "mastered"
  MAX_POWER: 65535,             // uint16 max (EWMA storage scale)
  RULE_SLOTS: 560,              // 28 sections × 20 rules
  RULES_PER_SECTION: 20,

  // Question picker
  WEIGHT_FLOOR: 0.05,           // Minimum selection weight
  WEIGHT_UNATTEMPTED: 0.50,     // Weight for never-attempted rules
  WEIGHT_EXPONENT: 2,           // (1 - power)^N exponent

  // Learn Whatever budget
  LEARN_TOTAL: 20,
  LEARN_FOCUS: 9,
  LEARN_FOCUS_ENCOURAGE: 1,
  LEARN_ADJACENT: 4,
  LEARN_ADJACENT_ENCOURAGE: 1,
  LEARN_LEFTFIELD: 4,
  LEARN_LEFTFIELD_ENCOURAGE: 1,
  ENCOURAGE_THRESHOLD: 0.6,     // Min display power for "encouragement" source

  // Sync
  FLUSH_INTERVAL_MS: 30_000,

  // Allow list — pulled at build time, no runtime constants needed
} as const;

// Display tiers
export const TIERS = [
  { min: 0.95, label: 'Maîtrisé !',     color: 'yellow-400',  promo: 'Bravo, vous maîtrisez ce sujet !' },
  { min: 0.80, label: 'Très avancé',     color: 'emerald-400', promo: 'La maîtrise approche !' },
  { min: 0.60, label: 'Avancé',          color: 'orange-400',  promo: 'Vous devenez solide !' },
  { min: 0.40, label: 'Intermédiaire',   color: 'amber-400',   promo: 'Niveau intermédiaire atteint !' },
  { min: 0.20, label: 'En progrès',      color: 'teal-400',    promo: 'Vous progressez, continuez !' },
  { min: 0.00, label: 'Débutant',        color: 'sky-400',     promo: 'Première étape franchie !' },
] as const;
```
