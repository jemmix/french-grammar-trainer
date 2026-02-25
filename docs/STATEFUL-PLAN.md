# Stateful Progress Tracking — Design & Implementation Plan

## Overview

Transform the French Grammar Trainer from a stateless quiz app into a stateful learning system with progress tracking, adaptive question selection, and guided learning. Storage is K/V (userId → binary blob). Auth is next-auth/Google in production, none in dev.

---

## 1. Data Model

### 1.1 User Record (binary blob)

All user state is packed into a single binary blob stored as the value in the K/V store. The format is dense (fixed-size slots for all 560 rules = 28 sections × 20 rules).

```
┌─────────────────────────────────────────────┐
│ Header (11 bytes)                           │
│   version:      uint8    (1)  — schema v.   │
│   createdAt:    uint32   (4)  — unix secs   │
│   lastActiveAt: uint32   (4)  — unix secs   │
│   ruleSlots:    uint16   (2)  — always 560  │
├─────────────────────────────────────────────┤
│ Rule Slots (15 bytes × 560 = 8400 bytes)    │
│   bitmask_hi:     uint32 (4)  — bits 32-63  │
│   bitmask_lo:     uint32 (4)  — bits 0-31   │
│   answeredCount:  uint8  (1)  — 0-64        │
│   totalAnswered:  uint16 (2)  — 0-65535     │
│   lastAnsweredAt: uint32 (4)  — unix secs   │
└─────────────────────────────────────────────┘

Total: 11 + 8400 = 8411 bytes ≈ 8.2 KB per user
```

**Why dense, not sparse?** 8.2 KB is negligible for any K/V store. Dense layout means slot index is computed directly from rule ID (`(sectionIdx * 20) + ruleIdx`), no search needed. Unattempted rules are all-zeros.

**Why two uint32 instead of uint64?** DataView's `getBigUint64`/`setBigUint64` exists in modern browsers but adds BigInt conversion overhead. Two uint32s are simpler and faster for bitwise operations.

### 1.2 Rule Slot Fields

| Field | Description |
|-------|-------------|
| `bitmask` (64 bits) | Circular buffer of last 64 results. Bit 0 = most recent, bit 63 = oldest. `1` = correct, `0` = wrong. |
| `answeredCount` | How many of the 64 bits are meaningful (0–64). Once it reaches 64, it stays at 64 — older results are silently pushed out. |
| `totalAnswered` | Lifetime attempt count (capped at 65535). Used for display ("you've practiced this rule 47 times") but not for power level. |
| `lastAnsweredAt` | Unix timestamp (seconds) of the most recent answer. Used for staleness detection and tiebreaking. |

### 1.3 Recording an Answer

When the user answers a question for rule at slot index `s`:

```
slot = record.rules[s]
// Shift bitmask left by 1, insert new result at bit 0
slot.bitmask = (slot.bitmask << 1) | (correct ? 1 : 0)
// Only keep lower 64 bits (mask off overflow)
slot.bitmask = slot.bitmask & 0xFFFFFFFF_FFFFFFFF
slot.answeredCount = min(64, slot.answeredCount + 1)
slot.totalAnswered = min(65535, slot.totalAnswered + 1)
slot.lastAnsweredAt = now()
```

In practice with two uint32s:

```typescript
function recordAnswer(slot: RuleSlot, correct: boolean): void {
  // Shift: carry bit 31→lo into bit 0→hi
  const carry = (slot.bitmaskLo >>> 31) & 1;
  slot.bitmaskHi = ((slot.bitmaskHi << 1) | carry) >>> 0;
  slot.bitmaskLo = ((slot.bitmaskLo << 1) | (correct ? 1 : 0)) >>> 0;
  slot.answeredCount = Math.min(64, slot.answeredCount + 1);
  slot.totalAnswered = Math.min(65535, slot.totalAnswered + 1);
  slot.lastAnsweredAt = Math.floor(Date.now() / 1000);
}
```

---

## 2. Power Level Computation

### 2.1 Per-Rule Power Level

**Goal:** A number in `[0, 1]` where newer answers weigh more than older ones, and we penalize low sample sizes to prevent 2/2 = "mastered".

**Step 1 — Weighted accuracy** using exponential decay:

```
decay = 0.97

rawPower = Σ(bit_i × decay^i, i = 0..answeredCount-1)
           ÷ Σ(decay^i, i = 0..answeredCount-1)
```

Where `bit_i` is the i-th bit of the bitmask (bit 0 = most recent).

The decay factor `0.97` means:
- The 10th-oldest answer has weight `0.97^10 ≈ 0.74` (74% of the newest)
- The 30th-oldest has weight `0.97^30 ≈ 0.40` (40%)
- The 64th-oldest has weight `0.97^63 ≈ 0.15` (15%)

This gives meaningful recency bias without completely ignoring old data.

**Step 2 — Confidence ramp** to penalize small sample sizes:

```
confidence = min(1, answeredCount / 10)
powerLevel = rawPower × confidence
```

Effect of the confidence ramp:
| Answers | Confidence | 100% correct → powerLevel |
|---------|------------|---------------------------|
| 1       | 0.10       | 0.10                      |
| 3       | 0.30       | 0.30                      |
| 5       | 0.50       | 0.50                      |
| 10      | 1.00       | 1.00                      |
| 20      | 1.00       | 1.00                      |

This prevents premature mastery labels. A learner needs at least 10 answers (all correct) to even reach 1.0, and realistically ~20+ answers with ≥95% accuracy to sustain mastery.

**Implementation:**

```typescript
function computePowerLevel(slot: RuleSlot): number {
  if (slot.answeredCount === 0) return 0;

  const DECAY = 0.97;
  let weightedSum = 0;
  let weightTotal = 0;

  for (let i = 0; i < slot.answeredCount; i++) {
    const bit = getBit(slot, i);  // 0 or 1
    const weight = DECAY ** i;
    weightedSum += bit * weight;
    weightTotal += weight;
  }

  const rawPower = weightedSum / weightTotal;
  const confidence = Math.min(1, slot.answeredCount / 10);
  return rawPower * confidence;
}

function getBit(slot: RuleSlot, position: number): number {
  if (position < 32) {
    return (slot.bitmaskLo >>> position) & 1;
  } else {
    return (slot.bitmaskHi >>> (position - 32)) & 1;
  }
}
```

### 2.2 Per-Section Power Level

```
sectionPower = mean(powerLevel(rule) for rule in section.rules if rule.answeredCount > 0)
```

If no rules in the section have been attempted, `sectionPower = 0` (display as "Pas encore commencé").

### 2.3 Global Power Level

```
globalPower = mean(powerLevel(rule) for all rules if rule.answeredCount > 0)
```

Same "not started" handling if nothing has been attempted.

### 2.4 Display Tiers

All labels and UI text in French. Colors chosen to feel warm/encouraging, avoiding red for low levels.

| Range | Label | Color | Emoji-free indicator |
|-------|-------|-------|---------------------|
| No data | Pas encore commencé | `slate-400` (muted gray) | Empty progress ring |
| 0.00–0.20 | Débutant | `sky-400` (friendly blue) | ~1/5 filled ring |
| 0.20–0.40 | En progrès | `teal-400` | ~2/5 filled ring |
| 0.40–0.60 | Intermédiaire | `amber-400` | ~3/5 filled ring |
| 0.60–0.80 | Avancé | `orange-400` | ~4/5 filled ring |
| 0.80–0.95 | Très avancé | `emerald-400` | Nearly full ring |
| 0.95–1.00 | Maîtrisé ! | `yellow-400` (gold) | Full ring + glow |

The progress ring is an SVG `<circle>` with `stroke-dasharray` animated proportional to the power level. Section cards on the home page show the ring + label. The global power level appears in a persistent header/banner.

**Tone:** Always supportive. Even at 0.05 the message is "Débutant" (neutral/positive), never "Faible" or "Insuffisant". The ring always shows *some* progress once any answer is recorded.

---

## 3. Storage Layer

### 3.1 Interface

```typescript
interface UserStore {
  get(userId: string): Promise<Uint8Array | null>;
  put(userId: string, data: Uint8Array): Promise<void>;
}
```

Raw bytes in, raw bytes out. Encoding/decoding is handled by a separate `UserRecord` codec, not the store.

### 3.2 SQLite Implementation (Dev)

Use `better-sqlite3` (synchronous, fast, zero-config). Single table:

```sql
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  data BLOB NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

The SQLite file lives at `data/dev.sqlite3` (gitignored). On first request, auto-create the DB and table.

### 3.3 R2 Implementation (Prod)

Cloudflare R2 accessed via S3-compatible API using `@aws-sdk/client-s3`:

```
Bucket: french-grammar-trainer-users
Key:    users/{userId}
Value:  raw binary blob (8411 bytes)
```

R2 has no per-request latency concerns for reads/writes of <10 KB. The S3 `GetObject`/`PutObject` API is sufficient.

### 3.4 Binary Codec

```typescript
// Encode UserRecord → Uint8Array (8411 bytes)
function encodeUserRecord(record: UserRecord): Uint8Array

// Decode Uint8Array → UserRecord
function decodeUserRecord(data: Uint8Array): UserRecord

// Create empty UserRecord for a new user
function createEmptyUserRecord(): UserRecord
```

The codec includes version checking. If `version` doesn't match the current schema, a migration function converts old format → new. This is forward-compatible: adding fields means bumping the version and extending the slot size, with the migration zero-filling new fields.

---

## 4. API Routes

All routes live under `src/pages/api/`.

### 4.1 `GET /api/progress`

Returns the user's full progress record (decoded to JSON for the client).

```typescript
// Response: { rules: { [ruleId: string]: RuleProgress }, createdAt, lastActiveAt }
// Or 204 No Content if no record exists (new user)
```

### 4.2 `POST /api/progress`

Accepts a batch of answer results and applies them to the stored record.

```typescript
// Request body:
{
  answers: Array<{ ruleId: string; correct: boolean; timestamp: number }>
}
// Response: { ok: true, record: <updated full record> }
```

**Why batch?** The quiz page can buffer answers locally and send them in one request at the end of a quiz (or periodically). This reduces API calls and handles offline-then-sync scenarios gracefully.

**Conflict resolution:** Last-write-wins at the blob level. Since we're not doing concurrent multi-device, this is fine. The API route reads the current blob, applies answers sequentially, writes back.

### 4.3 `GET /api/session`

Returns the current user's session info (userId, display tier, etc.). In dev mode, returns a hardcoded dev user.

### 4.4 User ID Resolution

```typescript
function resolveUserId(req: NextApiRequest): string {
  if (process.env.NODE_ENV === "development") {
    return "dev-user";
  }
  // In production: extract from next-auth session
  const session = await getServerSession(req, res, authOptions);
  return session.userId;  // pre-hashed at auth time
}
```

---

## 5. Auth

### 5.1 Dev Mode

No auth. All requests use userId `"dev-user"`. No login UI shown.

### 5.2 Production: next-auth with Google

```typescript
// src/pages/api/auth/[...nextauth].ts
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        // Hash the Google `sub` (stable unique ID) — one-way, no PII stored
        token.userId = sha256(account.providerAccountId + HASH_SALT);
      }
      return token;
    },
    async session({ session, token }) {
      session.userId = token.userId;
      return session;
    },
  },
  // Use JWT strategy — no database needed for sessions
  session: { strategy: "jwt" },
  // Don't store user/account/session in a database
  // next-auth's default behavior stores nothing when no adapter is configured
};
```

**Hash construction:** `SHA-256(googleSubId + HASH_SALT)` where `HASH_SALT` is an env var. The salt prevents rainbow table attacks against Google sub IDs (which are numeric and predictable in range). The hash is hex-encoded (64 chars), used as the K/V key.

**No PII stored anywhere:** No email, no name, no profile picture. The only identifier is the irreversible hash of Google's sub claim.

### 5.3 Login UI

A simple "Se connecter avec Google" button on the home page (production only). Styled to match the app's aesthetic. After login, the button is replaced by a small user indicator (just a colored dot or initials derived from the hash, nothing identifying).

---

## 6. Client-Side State Management

### 6.1 Progress Context

A React context provides progress data to all components:

```typescript
interface ProgressContextValue {
  record: UserRecord | null;      // null = loading or not logged in
  isLoading: boolean;
  recordAnswer: (ruleId: string, correct: boolean) => void;
  getRulePower: (ruleId: string) => number;
  getSectionPower: (sectionId: string) => number;
  getGlobalPower: () => number;
  flush: () => Promise<void>;     // force-send buffered answers to server
}
```

### 6.2 Answer Buffering

Answers are applied to the local `UserRecord` immediately (for instant UI feedback) and queued for server sync. The queue is flushed:

1. At the end of a quiz (on the score summary screen)
2. Every 30 seconds if there are pending answers
3. On `beforeunload` (best-effort via `navigator.sendBeacon`)

This means the UI always shows up-to-date power levels, even if the server write hasn't completed yet.

### 6.3 Initialization Flow

```
App mount
  → GET /api/session (resolve userId)
  → GET /api/progress (fetch record)
  → If 204: create empty local UserRecord
  → Set context, render app
```

In dev mode, the session call returns immediately with `"dev-user"`. The progress record is loaded from SQLite (or created fresh on first visit).

---

## 7. Smart Question Picker

### 7.1 Rule Ranking

All question selection starts by ranking rules. Each rule gets a **selection weight** inversely proportional to its power level:

```
weight(rule) = (1 - powerLevel(rule))^2 + 0.05
```

The squaring amplifies the preference for weak rules. The `+0.05` floor ensures even mastered rules have a small chance of appearing (prevents "never see it again" syndrome).

For unattempted rules (answeredCount = 0), assign a moderate weight of `0.50` — high enough to surface new material, but not so high that it dominates over known-weak rules.

### 7.2 Weighted Random Selection

Used throughout the picker to select a rule from a weighted list:

```typescript
function weightedRandomPick<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];  // fallback (floating point edge case)
}
```

### 7.3 Section Quiz Mode (Existing, Enhanced)

The current 20-question section quiz is enhanced with power-aware weighting:

1. Group section's questions by rule
2. Compute selection weight for each rule (§7.1)
3. For each of the 20 question slots:
   - Pick a rule via weighted random (§7.2)
   - Pick a random question from that rule (avoiding repeats within the quiz)
4. Shuffle the final 20 questions

This replaces the current uniform-random selection. Weaker rules appear more often, but stronger rules still show up (thanks to the `0.05` floor weight).

### 7.4 "Apprendre librement" Mode (Learn Whatever)

A new mode accessible from the home page. Selects 20 questions using this algorithm:

```
BUDGET ALLOCATION (20 questions total):
  Focus rule questions:    9
  Encouragement question:  1  (from a strong rule, disguised in the focus batch)
  Adjacent rule questions: 4
  Adjacent encouragement:  1  (from a strong rule in the same section)
  Left-field questions:    4
  Left-field encouragement:1  (from a strong rule in another section)
                          ──
                          20
```

**Step-by-step:**

1. **Select focus section:** Weighted random from sections by section weight (inverse of section power level). Sections with no content (questionCount = 0) are excluded.

2. **Select focus rule:** From the focus section, weighted random pick from its rules (§7.1).

3. **Pick 9 focus questions:** Random questions from the focus rule. If the rule has fewer than 9 questions, supplement from other weak rules in the same section.

4. **Pick 1 encouragement question (focus batch):** Find the highest-power rule in the focus section with powerLevel > 0.6 (or any attempted rule if none qualify). Pick a random question from it. This is shuffled in with the focus questions — the learner doesn't know it's a confidence boost.

5. **Select adjacent rules:** From the focus section, pick rules that are neighbors of the focus rule in Table of Contents order (±1, ±2 positions). Weighted random from these for 4 questions.

6. **Pick 1 adjacent encouragement:** From the focus section, find a strong rule (different from step 4's rule if possible), pick 1 question.

7. **Select left-field sections:** From all sections except the focus section, weighted random pick 2–3 sections. Pick 4 questions spread across their weak rules.

8. **Pick 1 left-field encouragement:** From any non-focus section, find a strong rule, pick 1 question.

9. **Shuffle all 20 questions** (Fisher-Yates).

**Randomness guarantees:**
- The focus rule is *weighted* random, not deterministic — the weakest rule is *most likely* but not guaranteed
- The 0.05 floor weight means even strong rules occasionally become the focus (≈5% base probability per rule)
- Encouragement questions are unlabeled — the learner just experiences periodic easy questions naturally
- If the user has no history at all, all weights are equal (0.50), producing a uniform spread

### 7.5 Edge Cases

| Scenario | Behavior |
|----------|----------|
| Brand new user (no history) | All rules weighted equally (0.50). Focus rule is random. Encouragement questions are random too (no "strong" rules yet). |
| Only one section attempted | "Left field" draws from the attempted section's weaker rules instead. |
| A rule has very few questions (<5) | Supplement from adjacent rules in the same section. |
| All rules mastered (>0.95) | Weights are all `(1-0.95)^2 + 0.05 = 0.0525`. Selection becomes roughly uniform — a celebratory "review everything" mode. |
| User hasn't practiced in weeks | Power levels persist as-is (no time decay). The bitmask remembers the last 64 results regardless of when they happened. This is intentional: we don't penalize breaks. |

---

## 8. UI Changes

### 8.1 Home Page — Section Cards

Each section card gains:
- A **progress ring** (SVG circle) showing section power level
- The **tier label** ("Débutant", "Intermédiaire", etc.) below the ring
- A subtle count: "42 questions pratiquées" (total answered across the section's rules)
- Color-coded ring matching the tier color

Cards for sections with no progress show a muted empty ring and "Pas encore commencé".

### 8.2 Home Page — Global Progress Banner

A horizontal bar or hero section at the top showing:
- Global power level as a large progress ring
- Global tier label
- An encouraging message that varies by tier (e.g., "Vous progressez bien ! Continuez comme ça.")

### 8.3 Home Page — "Apprendre librement" Button

A prominent CTA button (distinct from section cards) that launches the guided learning mode (§7.4). Positioned above the section grid. Text: "Apprendre librement" with a subtitle like "20 questions adaptées à votre niveau".

### 8.4 Quiz Page — Per-Rule Power Display

At the end of a quiz (score summary), show:
- Per-rule power level changes: "Règle X: 0.45 → 0.52 (+0.07)"
- Section power level change
- Supportive message based on improvement

### 8.5 Quiz Page — Question Feedback Enhancement

After answering, show a subtle indicator of the rule's current power level (small progress ring next to the rule name). This gives immediate feedback: "I'm getting better at this specific rule."

### 8.6 Design Principles

- Use the `frontend-design` skill for all UI implementation
- Progress indicators should feel warm and encouraging, never punitive
- Animations should be smooth and purposeful (ring fill, level transitions)
- Color transitions between tiers should be gradual (CSS transitions on the ring color)
- Mobile-first: rings and labels must work well on small screens

---

## 9. Implementation Phases

### Phase 1: Core Data Layer
1. Define `UserRecord` TypeScript types and the `RuleSlot` interface
2. Implement binary codec (`encode`/`decode`/`createEmpty`)
3. Implement `computePowerLevel`, `getSectionPower`, `getGlobalPower`
4. Write unit tests for codec and power level math
5. Implement `UserStore` interface + `SqliteUserStore`
6. Create API routes (`/api/progress`, `/api/session`)
7. Add `better-sqlite3` dependency

### Phase 2: Client-Side Progress
1. Create `ProgressContext` and `ProgressProvider`
2. Wire up answer recording in quiz page (call `recordAnswer` after each question)
3. Implement answer buffering and server sync
4. Wire up `GET /api/progress` on app init
5. Test full round-trip: answer question → local update → server write → reload → data persists

### Phase 3: Progress UI
1. Build progress ring SVG component
2. Add power level display to section cards (home page)
3. Add global progress banner to home page
4. Add per-rule power changes to quiz score summary
5. Add subtle power indicator to question feedback
6. Use `frontend-design` skill for polished implementation

### Phase 4: Smart Question Picker
1. Extract question picker into a dedicated module (`src/lib/question-picker.ts`)
2. Implement weighted rule selection (§7.1, §7.2)
3. Enhance section quiz mode with power-aware weighting (§7.3)
4. Implement "Apprendre librement" mode (§7.4)
5. Add the "Apprendre librement" button and route to home page
6. Test edge cases (new user, all mastered, sparse data)

### Phase 5: Production Auth & Storage
1. Add `next-auth` with Google provider
2. Implement `R2UserStore` with `@aws-sdk/client-s3`
3. Add userId hashing (SHA-256 + salt)
4. Add login/logout UI (production only)
5. Environment-based store selection (SQLite vs R2)
6. Test full production flow

---

## 10. File Structure (New/Modified)

```
src/
├── lib/
│   ├── user-record.ts        # UserRecord types, binary codec, power level computation
│   ├── user-store.ts          # UserStore interface
│   ├── sqlite-store.ts        # SQLite implementation
│   ├── r2-store.ts            # R2/S3 implementation (Phase 5)
│   ├── question-picker.ts     # Smart question selection algorithms
│   └── auth.ts                # next-auth config, userId hashing (Phase 5)
├── contexts/
│   └── progress-context.tsx   # ProgressContext + ProgressProvider
├── components/
│   ├── progress-ring.tsx      # SVG progress ring component
│   ├── power-label.tsx        # Tier label component
│   └── global-progress.tsx    # Global progress banner
├── pages/
│   ├── api/
│   │   ├── progress.ts        # GET/POST progress
│   │   ├── session.ts         # GET session info
│   │   └── auth/
│   │       └── [...nextauth].ts  # next-auth (Phase 5)
│   ├── index.tsx              # Modified: add progress rings, banner, learn button
│   ├── quiz/
│   │   ├── [sectionId].tsx    # Modified: record answers, show power changes
│   │   └── learn.tsx          # New: "Apprendre librement" quiz page
│   └── _app.tsx               # Modified: wrap with ProgressProvider
data/
│   └── dev.sqlite3            # gitignored, auto-created
```

---

## 11. Dependencies to Add

| Package | Purpose | Phase |
|---------|---------|-------|
| `better-sqlite3` | SQLite for dev storage | 1 |
| `@types/better-sqlite3` | TypeScript types | 1 |
| `next-auth` | Auth framework | 5 |
| `@auth/core` | next-auth peer dep | 5 |
| `@aws-sdk/client-s3` | R2 access via S3 API | 5 |

---

## 12. Constants & Tunables

All magic numbers collected in one config object for easy tuning:

```typescript
// src/lib/constants.ts
export const PROGRESS = {
  DECAY_FACTOR: 0.97,           // Exponential decay for bitmask weighting
  CONFIDENCE_RAMP: 10,          // Answers needed for full confidence
  MASTERY_THRESHOLD: 0.95,      // Power level considered "mastered"
  BITMASK_SIZE: 64,             // Number of answers tracked per rule
  RULE_SLOTS: 560,              // 28 sections × 20 rules
  RULES_PER_SECTION: 20,

  // Question picker
  WEIGHT_FLOOR: 0.05,           // Minimum selection weight (even for mastered)
  WEIGHT_UNATTEMPTED: 0.50,     // Weight for never-attempted rules
  WEIGHT_EXPONENT: 2,           // (1 - power)^N exponent for amplifying weakness

  // Learn Whatever budget
  LEARN_TOTAL: 20,
  LEARN_FOCUS: 9,
  LEARN_FOCUS_ENCOURAGE: 1,
  LEARN_ADJACENT: 4,
  LEARN_ADJACENT_ENCOURAGE: 1,
  LEARN_LEFTFIELD: 4,
  LEARN_LEFTFIELD_ENCOURAGE: 1,
  ENCOURAGE_THRESHOLD: 0.6,     // Min power to qualify as "encouragement" source

  // Sync
  FLUSH_INTERVAL_MS: 30_000,    // Auto-flush buffered answers every 30s
} as const;
```
