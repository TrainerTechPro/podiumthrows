# WHOOP Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect athletes' WHOOP straps to auto-sync recovery, sleep, and HRV data into the readiness check-in system via OAuth2 + webhooks.

**Architecture:** OAuth2 authorization code flow connects WHOOP accounts. Webhooks push data in real-time. AUTO mode creates check-ins automatically; ASSISTED mode pre-fills the form. Tokens encrypted with AES-256-GCM. Fallback cron for missed webhooks.

**Tech Stack:** WHOOP API v2, OAuth2, AES-256-GCM encryption, Next.js 14.2 API routes, Prisma, Vercel cron jobs.

**Spec:** `docs/superpowers/specs/2026-03-21-whoop-integration-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/whoop/client.ts` | WHOOP API client — fetch recovery, sleep, profile. Token refresh logic. |
| `src/lib/whoop/crypto.ts` | AES-256-GCM encrypt/decrypt for OAuth tokens |
| `src/lib/whoop/sync.ts` | Data sync logic — map WHOOP data to ReadinessCheckIn, create snapshots |
| `src/app/api/whoop/authorize/route.ts` | GET — redirect to WHOOP OAuth |
| `src/app/api/whoop/callback/route.ts` | GET — handle OAuth callback, create WhoopConnection |
| `src/app/api/whoop/webhook/route.ts` | POST — receive WHOOP webhook events |
| `src/app/api/whoop/disconnect/route.ts` | POST — revoke + delete connection |
| `src/app/api/whoop/sync/route.ts` | POST — manual sync trigger |
| `src/app/api/cron/whoop-sync/route.ts` | GET — daily fallback cron |
| `src/app/(dashboard)/athlete/settings/_whoop-card.tsx` | Client component — connect/disconnect/configure WHOOP |

### Modified Files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add WhoopConnection, WhoopDailySnapshot, ReadinessCheckIn fields |
| `src/app/(dashboard)/athlete/settings/page.tsx` | Add WHOOP card to settings |
| `src/app/(dashboard)/athlete/wellness/_checkin-form.tsx` | Pre-fill from WHOOP snapshot, show metric pills |
| `src/app/api/athlete/readiness/route.ts` | Accept new WHOOP fields (hrvMs, restingHR, spo2, whoopStrain, source) |
| `vercel.json` | Add whoop-sync cron job |
| `src/middleware.ts` | Add `/api/whoop/callback` and `/api/whoop/webhook` to public paths |

---

### Task 1: Schema — Add WHOOP Models + ReadinessCheckIn Fields

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add WhoopConnection model**

```prisma
model WhoopConnection {
  id             String         @id @default(cuid())
  athleteId      String         @unique
  athlete        AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  whoopUserId    Int
  accessToken    String
  refreshToken   String
  tokenExpiresAt DateTime
  scopes         String
  syncMode       String         @default("ASSISTED")
  lastSyncAt     DateTime?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  snapshots      WhoopDailySnapshot[]

  @@index([whoopUserId])
}
```

- [ ] **Step 2: Add WhoopDailySnapshot model**

```prisma
model WhoopDailySnapshot {
  id               String          @id @default(cuid())
  connectionId     String
  connection       WhoopConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  date             String
  recoveryScore    Float?
  hrvMs            Float?
  restingHR        Float?
  spo2             Float?
  skinTempC        Float?
  sleepPerformance Float?
  sleepDurationMs  Int?
  sleepEfficiency  Float?
  lightSleepMs     Int?
  swsSleepMs       Int?
  remSleepMs       Int?
  strain           Float?
  rawData          String?
  createdAt        DateTime @default(now())

  @@unique([connectionId, date])
  @@index([connectionId, date])
}
```

- [ ] **Step 3: Add fields to ReadinessCheckIn**

Add to the existing `ReadinessCheckIn` model:
```prisma
  hrvMs        Float?
  restingHR    Float?
  spo2         Float?
  whoopStrain  Float?
  source       String    @default("MANUAL")
```

- [ ] **Step 4: Add relation to AthleteProfile**

Add to `AthleteProfile`:
```prisma
  whoopConnection  WhoopConnection?
```

- [ ] **Step 5: Run migration**

```bash
npx prisma migrate dev --name add_whoop_integration
npx prisma generate
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add prisma/
git commit -m "feat: add WhoopConnection, WhoopDailySnapshot models + ReadinessCheckIn WHOOP fields"
```

---

### Task 2: Token Encryption + WHOOP API Client

**Files:**
- Create: `src/lib/whoop/crypto.ts`
- Create: `src/lib/whoop/client.ts`

- [ ] **Step 1: Create crypto utility**

Create `src/lib/whoop/crypto.ts`:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.WHOOP_ENCRYPTION_KEY;
  if (!key) throw new Error("WHOOP_ENCRYPTION_KEY is not set");
  return Buffer.from(key, "hex");
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(encoded: string): string {
  const [ivHex, tagHex, ciphertextHex] = encoded.split(":");
  if (!ivHex || !tagHex || !ciphertextHex) throw new Error("Invalid encrypted token format");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
```

- [ ] **Step 2: Create WHOOP API client**

Create `src/lib/whoop/client.ts`:

```typescript
import prisma from "@/lib/prisma";
import { encrypt, decrypt } from "./crypto";

const WHOOP_API = "https://api.prod.whoop.com/developer";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

export interface WhoopRecovery {
  recoveryScore: number | null;
  hrvMs: number | null;
  restingHR: number | null;
  spo2: number | null;
  skinTempC: number | null;
}

export interface WhoopSleep {
  sleepPerformance: number | null;
  sleepDurationMs: number | null;
  sleepEfficiency: number | null;
  lightSleepMs: number | null;
  swsSleepMs: number | null;
  remSleepMs: number | null;
}

export interface WhoopStrain {
  strain: number | null;
}

/** Get a valid access token, refreshing if expired */
async function getAccessToken(connectionId: string): Promise<string> {
  const conn = await prisma.whoopConnection.findUnique({ where: { id: connectionId } });
  if (!conn) throw new Error("WHOOP connection not found");

  const accessToken = decrypt(conn.accessToken);

  // If token is still valid (with 5-min buffer), return it
  if (conn.tokenExpiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return accessToken;
  }

  // Refresh the token
  const refreshToken = decrypt(conn.refreshToken);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    throw new Error(`WHOOP token refresh failed: ${res.status}`);
  }

  const data = await res.json();
  await prisma.whoopConnection.update({
    where: { id: connectionId },
    data: {
      accessToken: encrypt(data.access_token),
      refreshToken: encrypt(data.refresh_token),
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });

  return data.access_token;
}

/** Fetch latest recovery data */
export async function fetchRecovery(connectionId: string): Promise<WhoopRecovery> {
  const token = await getAccessToken(connectionId);
  const res = await fetch(`${WHOOP_API}/v2/recovery?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`WHOOP recovery fetch failed: ${res.status}`);
  const data = await res.json();
  const record = data.records?.[0];
  if (!record?.score) return { recoveryScore: null, hrvMs: null, restingHR: null, spo2: null, skinTempC: null };
  return {
    recoveryScore: record.score.recovery_score ?? null,
    hrvMs: record.score.hrv_rmssd_milli ?? null,
    restingHR: record.score.resting_heart_rate ?? null,
    spo2: record.score.spo2_percentage ?? null,
    skinTempC: record.score.skin_temp_celsius ?? null,
  };
}

/** Fetch latest sleep data */
export async function fetchSleep(connectionId: string): Promise<WhoopSleep> {
  const token = await getAccessToken(connectionId);
  const res = await fetch(`${WHOOP_API}/v2/activity/sleep?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`WHOOP sleep fetch failed: ${res.status}`);
  const data = await res.json();
  const record = data.records?.[0];
  if (!record?.score) return { sleepPerformance: null, sleepDurationMs: null, sleepEfficiency: null, lightSleepMs: null, swsSleepMs: null, remSleepMs: null };
  return {
    sleepPerformance: record.score.sleep_performance_percentage ?? null,
    sleepDurationMs: record.score.stage_summary?.total_in_bed_time_milli ?? null,
    sleepEfficiency: record.score.sleep_efficiency_percentage ?? null,
    lightSleepMs: record.score.stage_summary?.total_light_sleep_time_milli ?? null,
    swsSleepMs: record.score.stage_summary?.total_slow_wave_sleep_time_milli ?? null,
    remSleepMs: record.score.stage_summary?.total_rem_sleep_time_milli ?? null,
  };
}

/** Fetch latest daily strain */
export async function fetchStrain(connectionId: string): Promise<WhoopStrain> {
  const token = await getAccessToken(connectionId);
  const res = await fetch(`${WHOOP_API}/v2/cycle?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`WHOOP strain fetch failed: ${res.status}`);
  const data = await res.json();
  const record = data.records?.[0];
  return { strain: record?.score?.strain ?? null };
}

/** Fetch user profile (for whoopUserId) */
export async function fetchProfile(accessToken: string): Promise<{ userId: number; firstName: string; lastName: string; email: string }> {
  const res = await fetch(`${WHOOP_API}/v2/user/profile/basic`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`WHOOP profile fetch failed: ${res.status}`);
  const data = await res.json();
  return { userId: data.user_id, firstName: data.first_name, lastName: data.last_name, email: data.email };
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/lib/whoop/
git commit -m "feat: add WHOOP token encryption and API client"
```

---

### Task 3: Data Sync Logic

**Files:**
- Create: `src/lib/whoop/sync.ts`

- [ ] **Step 1: Create sync utility**

Create `src/lib/whoop/sync.ts` with:

- `syncWhoopData(connectionId)` — fetches recovery + sleep + strain, upserts `WhoopDailySnapshot`, and if AUTO mode creates/updates `ReadinessCheckIn`
- `getOrCreateAutoCheckIn(athleteId, snapshot)` — maps WHOOP data to ReadinessCheckIn fields with the mapping from the spec (recovery_score/10 → overallScore, sleep_performance/10 → sleepQuality, etc.)
- `getTodaySnapshot(athleteId)` — returns today's snapshot for ASSISTED mode pre-fill

Key mapping logic:
```typescript
const overallScore = Math.max(1, Math.min(10, (snapshot.recoveryScore ?? 50) / 10));
const sleepQuality = Math.max(1, Math.min(10, (snapshot.sleepPerformance ?? 50) / 10));
const sleepHours = snapshot.sleepDurationMs ? snapshot.sleepDurationMs / 3_600_000 : 7;
```

Auto check-ins use `source: "WHOOP_AUTO"` and default subjective fields (soreness=5, stress=5, energy=5, hydration="ADEQUATE", injuryStatus="NONE").

Uses upsert pattern: `prisma.readinessCheckIn.upsert({ where: { athleteId_date }, create: {...}, update: {...} })` — but since there's no unique constraint on (athleteId, date) by date string, use `findFirst` + `create/update` pattern instead.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/lib/whoop/sync.ts
git commit -m "feat: add WHOOP data sync logic with AUTO/ASSISTED modes"
```

---

### Task 4: OAuth Routes (Authorize + Callback)

**Files:**
- Create: `src/app/api/whoop/authorize/route.ts`
- Create: `src/app/api/whoop/callback/route.ts`
- Modify: `src/middleware.ts`

- [ ] **Step 1: Update middleware**

Add `/api/whoop/callback` to PUBLIC_PATHS (the callback comes from WHOOP's redirect, not an authenticated user session — but we verify via the `state` parameter). Also add `/api/whoop/webhook` (webhook comes from WHOOP servers, not user browser).

```typescript
const PUBLIC_PATHS = [...existing..., "/api/whoop/callback", "/api/whoop/webhook"];
```

Note: The CSRF middleware checks `STATE_CHANGING_METHODS` (POST, PUT, etc.) against a header. The webhook POST from WHOOP won't have our CSRF token. The middleware needs to skip CSRF for `/api/whoop/webhook`. Check the existing middleware logic — if it already skips CSRF for paths starting with `/api/whoop/`, great. If not, add an exception.

- [ ] **Step 2: Create authorize route**

Create `src/app/api/whoop/authorize/route.ts`:

- GET handler
- Verify authenticated session with `getSession()` + `canActAsAthlete()`
- Generate random `state` parameter
- Store state in a cookie (`whoop-oauth-state`, HttpOnly, SameSite=Lax, short maxAge=600)
- Redirect to WHOOP authorization URL with client_id, redirect_uri, response_type=code, scopes, state

- [ ] **Step 3: Create callback route**

Create `src/app/api/whoop/callback/route.ts`:

- GET handler
- Read `state` from query params, compare to `whoop-oauth-state` cookie
- Exchange `code` for tokens via POST to WHOOP token endpoint
- Fetch user profile to get `whoopUserId`
- Encrypt tokens with `encrypt()` from crypto.ts
- Create `WhoopConnection` record (or update if one exists for this athlete)
- Delete the state cookie
- Redirect to `/athlete/settings?whoop=connected`

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/whoop/authorize/ src/app/api/whoop/callback/ src/middleware.ts
git commit -m "feat: add WHOOP OAuth authorize + callback routes"
```

---

### Task 5: Webhook + Disconnect + Manual Sync Routes

**Files:**
- Create: `src/app/api/whoop/webhook/route.ts`
- Create: `src/app/api/whoop/disconnect/route.ts`
- Create: `src/app/api/whoop/sync/route.ts`

- [ ] **Step 1: Create webhook handler**

Create `src/app/api/whoop/webhook/route.ts`:

- POST handler (no auth — comes from WHOOP servers)
- Parse webhook payload for event type and user ID
- Look up `WhoopConnection` by `whoopUserId`
- If not found, return 200 (user disconnected, ignore)
- Call `syncWhoopData(connection.id)` from sync.ts
- Return 200

- [ ] **Step 2: Create disconnect route**

Create `src/app/api/whoop/disconnect/route.ts`:

- POST handler with athlete auth (`getSession` + `canActAsAthlete`)
- Find the athlete's `WhoopConnection`
- Call WHOOP API `DELETE /v2/user/access` to revoke our token
- Delete `WhoopConnection` record (cascades snapshots)
- Return `{ ok: true }`

- [ ] **Step 3: Create manual sync route**

Create `src/app/api/whoop/sync/route.ts`:

- POST handler with athlete auth
- Find athlete's `WhoopConnection`
- Call `syncWhoopData(connection.id)`
- Return `{ ok: true, data: snapshot }`

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/whoop/
git commit -m "feat: add WHOOP webhook, disconnect, and manual sync routes"
```

---

### Task 6: Fallback Cron Job

**Files:**
- Create: `src/app/api/cron/whoop-sync/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create cron route**

Create `src/app/api/cron/whoop-sync/route.ts`:

- GET handler protected by `CRON_SECRET` header (same pattern as existing cron routes)
- Query all `WhoopConnection` records where `lastSyncAt` is null or older than 20 hours
- For each: call `syncWhoopData(connection.id)` with try/catch (don't let one failure stop others)
- Return count of synced connections

- [ ] **Step 2: Add to vercel.json**

Add to the `crons` array:
```json
{
  "path": "/api/cron/whoop-sync",
  "schedule": "0 8 * * *"
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/whoop-sync/ vercel.json
git commit -m "feat: add daily WHOOP sync fallback cron job"
```

---

### Task 7: Athlete Settings — WHOOP Connection Card

**Files:**
- Create: `src/app/(dashboard)/athlete/settings/_whoop-card.tsx`
- Modify: `src/app/(dashboard)/athlete/settings/page.tsx`

- [ ] **Step 1: Create WHOOP card component**

Create `src/app/(dashboard)/athlete/settings/_whoop-card.tsx`:

Client component. Props: `{ connected: boolean, syncMode?: string, lastSyncAt?: string }`.

**Disconnected state:**
- Card with WHOOP strap icon (use a custom SVG or Lucide `Watch` icon)
- "Connect your WHOOP strap" description
- "Connect WHOOP" button → navigates to `/api/whoop/authorize`

**Connected state:**
- Green "Connected" badge
- Last sync time
- Sync mode toggle: Auto / Assisted (segmented control, calls PUT to update `syncMode`)
  - Auto label: "Check-ins created automatically"
  - Assisted label: "Pre-fills your check-in form"
- "Disconnect" button (danger text, confirm dialog)
- Manual "Sync Now" button (calls POST `/api/whoop/sync`)

Design system: `card` class, `<Button>` component, design tokens.

- [ ] **Step 2: Add to settings page**

In `src/app/(dashboard)/athlete/settings/page.tsx`:
- Query the athlete's `WhoopConnection` (include in the profile fetch or separate query)
- Pass connection data to `<WhoopCard>` component
- Add an "Integrations" section heading before the card

Also add a PUT endpoint or inline handler for updating `syncMode` — simplest: `PUT /api/whoop/sync-mode` or handle it in the existing settings API.

- [ ] **Step 3: Handle `?whoop=connected` query param**

Show a success toast when the page loads with `?whoop=connected` in the URL (the OAuth callback redirects here).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx next lint`

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/athlete/settings/"
git commit -m "feat: add WHOOP connection card to athlete settings"
```

---

### Task 8: Check-In Form — WHOOP Pre-Fill (ASSISTED Mode)

**Files:**
- Modify: `src/app/(dashboard)/athlete/wellness/_checkin-form.tsx`
- Modify: `src/app/(dashboard)/athlete/wellness/page.tsx`
- Modify: `src/app/api/athlete/readiness/route.ts`

- [ ] **Step 1: Update readiness API to accept WHOOP fields**

In `src/app/api/athlete/readiness/route.ts`:
- Add optional fields to the Zod schema: `hrvMs`, `restingHR`, `spo2`, `whoopStrain`, `source`
- Pass them through to the `prisma.readinessCheckIn.create` call
- The `source` field defaults to "MANUAL" if not provided

Also update `src/lib/api-schemas.ts` if `ReadinessCheckInSchema` is defined there — add the optional fields.

- [ ] **Step 2: Fetch WHOOP snapshot in wellness page**

In `src/app/(dashboard)/athlete/wellness/page.tsx`:
- If athlete has a `WhoopConnection`, fetch today's `WhoopDailySnapshot`
- Pass snapshot data to the `CheckInForm` as a `whoopData` prop

- [ ] **Step 3: Pre-fill check-in form**

In `src/app/(dashboard)/athlete/wellness/_checkin-form.tsx`:
- Accept optional `whoopData` prop with snapshot fields
- If `whoopData` is present:
  - Show an amber banner: "WHOOP data available" with a strap icon
  - Pre-fill `sleepQuality` from `whoopData.sleepPerformance / 10` (clamped 1-10)
  - Pre-fill `sleepHours` from `whoopData.sleepDurationMs / 3_600_000`
  - Show read-only metric pills below the form: Recovery %, HRV ms, RHR bpm, SpO2 %
  - On submit, include `hrvMs`, `restingHR`, `spo2`, `whoopStrain` in the POST body with `source: "WHOOP_ASSISTED"`
- If no `whoopData`: form works identically to current behavior

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx next lint`

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/athlete/wellness/" src/app/api/athlete/readiness/ src/lib/api-schemas.ts
git commit -m "feat: pre-fill readiness check-in from WHOOP data in ASSISTED mode"
```

---

### Task 9: Final Verification + Cleanup

**Files:**
- All modified files

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 2: Full lint**

Run: `npx next lint`

- [ ] **Step 3: Verify middleware**

Confirm `/api/whoop/callback` and `/api/whoop/webhook` are in PUBLIC_PATHS and CSRF is skipped for webhook.

- [ ] **Step 4: Verify vercel.json**

Confirm whoop-sync cron is added.

- [ ] **Step 5: Verify env vars**

Confirm these are set in Vercel:
- `WHOOP_CLIENT_ID`
- `WHOOP_CLIENT_SECRET`
- `WHOOP_ENCRYPTION_KEY`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: WHOOP integration — complete implementation"
```
