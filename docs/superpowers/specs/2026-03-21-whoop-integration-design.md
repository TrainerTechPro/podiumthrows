# WHOOP Integration — Design Spec

## Goal

Connect athletes' WHOOP straps to Podium Throws so recovery, sleep, and HRV data automatically flow into the readiness check-in system — replacing manual entry or pre-filling the form with objective physiological data.

## Architecture

OAuth2 authorization code flow connects an athlete's WHOOP account. WHOOP pushes data via webhooks when recovery/sleep is scored. Data maps to the existing `ReadinessCheckIn` model with new fields for HRV, RHR, SpO2, and strain. Athletes choose between AUTO mode (fully automatic check-ins) or ASSISTED mode (WHOOP pre-fills, athlete reviews + adds subjective data).

## Tech Stack

- WHOOP API v2 (OAuth2 + webhooks)
- Prisma schema additions (WhoopConnection, WhoopDailySnapshot, ReadinessCheckIn fields)
- AES-256-GCM token encryption
- Next.js API routes for OAuth flow + webhook handler
- Existing readiness check-in form + wellness page

---

## 1. Data Model

### 1.1 WhoopConnection

```prisma
model WhoopConnection {
  id             String         @id @default(cuid())
  athleteId      String         @unique
  athlete        AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  whoopUserId    Int            // WHOOP's user_id (integer)
  accessToken    String         // AES-256-GCM encrypted
  refreshToken   String         // AES-256-GCM encrypted
  tokenExpiresAt DateTime
  scopes         String         // "read:recovery,read:sleep,read:profile,read:body_measurement,read:cycles,read:workout"
  syncMode       String         @default("ASSISTED") // AUTO | ASSISTED
  lastSyncAt     DateTime?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  snapshots      WhoopDailySnapshot[]

  @@index([whoopUserId])
}
```

### 1.2 WhoopDailySnapshot

Cache table for ASSISTED mode — stores latest WHOOP data until athlete submits their check-in.

```prisma
model WhoopDailySnapshot {
  id               String          @id @default(cuid())
  connectionId     String
  connection       WhoopConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  date             String          // YYYY-MM-DD
  recoveryScore    Float?          // 0-100
  hrvMs            Float?          // HRV RMSSD in ms
  restingHR        Float?          // bpm
  spo2             Float?          // percentage
  skinTempC        Float?          // celsius
  sleepPerformance Float?          // 0-100
  sleepDurationMs  Int?            // total in-bed time
  sleepEfficiency  Float?          // percentage
  lightSleepMs     Int?
  swsSleepMs       Int?            // slow wave sleep
  remSleepMs       Int?
  strain           Float?          // 0-21
  rawData          String?         // Full JSON response for debugging
  createdAt        DateTime        @default(now())

  @@unique([connectionId, date])
  @@index([connectionId, date])
}
```

### 1.3 ReadinessCheckIn Additions

Add new optional fields to the existing `ReadinessCheckIn` model:

```prisma
  // Wearable data (optional — null for manual check-ins)
  hrvMs        Float?    // Heart Rate Variability (RMSSD, ms)
  restingHR    Float?    // Resting heart rate (bpm)
  spo2         Float?    // Blood oxygen percentage
  whoopStrain  Float?    // Daily strain (0-21)
  source       String    @default("MANUAL") // MANUAL | WHOOP_AUTO | WHOOP_ASSISTED
```

### 1.4 Relation Additions

- `AthleteProfile`: add `whoopConnection WhoopConnection?`

---

## 2. OAuth Flow

### 2.1 Authorization

`GET /api/whoop/authorize`

1. Verify authenticated athlete session
2. Generate a `state` parameter (random string, store in a short-lived cookie or DB)
3. Redirect to:
   ```
   https://api.prod.whoop.com/oauth/oauth2/auth
     ?client_id=WHOOP_CLIENT_ID
     &redirect_uri=https://podiumthrows.vercel.app/api/whoop/callback
     &response_type=code
     &scope=read:recovery read:sleep read:cycles read:workout read:profile read:body_measurement
     &state=<state>
   ```

### 2.2 Callback

`GET /api/whoop/callback`

1. Verify `state` parameter matches
2. Exchange `code` for tokens via POST to `https://api.prod.whoop.com/oauth/oauth2/token`:
   ```
   grant_type=authorization_code
   code=<code>
   redirect_uri=<redirect_uri>
   client_id=WHOOP_CLIENT_ID
   client_secret=WHOOP_CLIENT_SECRET
   ```
3. Response contains: `access_token`, `refresh_token`, `expires_in`, `scope`
4. Fetch WHOOP user profile (`GET /v2/user/profile/basic`) to get `user_id`
5. Encrypt tokens with AES-256-GCM using `WHOOP_ENCRYPTION_KEY` env var
6. Create `WhoopConnection` record
7. Optionally fetch body measurements (`GET /v2/user/measurement/body`) and update AthleteProfile height/weight
8. Redirect to `/athlete/settings?whoop=connected`

### 2.3 Token Refresh

When making API calls, check `tokenExpiresAt`. If expired:
1. POST to token endpoint with `grant_type=refresh_token`
2. Update stored encrypted tokens + new expiry

### 2.4 Disconnect

`POST /api/whoop/disconnect`

1. Verify authenticated athlete session
2. Call `DELETE /v2/user/access` on WHOOP API (revokes our access)
3. Delete `WhoopConnection` record (cascades snapshots)
4. Return success

---

## 3. Data Sync via Webhooks

### 3.1 Webhook Endpoint

`POST /api/whoop/webhook`

WHOOP sends POST requests when member data changes. The webhook payload contains the event type and user ID.

1. Verify webhook authenticity (WHOOP webhook verification)
2. Look up `WhoopConnection` by `whoopUserId`
3. If not found, ignore (user disconnected)
4. Refresh access token if expired
5. Based on event type:
   - **Recovery scored**: Fetch `GET /v2/recovery` (limit=1), extract score + HRV + RHR + SpO2
   - **Sleep scored**: Fetch `GET /v2/activity/sleep` (limit=1), extract performance + duration + stages
6. Store in `WhoopDailySnapshot` (upsert by connectionId + date)
7. If `syncMode === "AUTO"`: create/update `ReadinessCheckIn` for today

### 3.2 AUTO Mode Check-In Creation

When creating an auto check-in from WHOOP data:

| WHOOP Field | ReadinessCheckIn Field | Mapping |
|---|---|---|
| `recovery_score` (0-100) | `overallScore` (1-10) | `Math.max(1, Math.min(10, score / 10))` |
| `sleep_performance_percentage` (0-100) | `sleepQuality` (1-10) | `Math.max(1, Math.min(10, perf / 10))` |
| `total_in_bed_time_milli` | `sleepHours` | `milli / 3_600_000` |
| `hrv_rmssd_milli` | `hrvMs` | Store raw |
| `resting_heart_rate` | `restingHR` | Store raw |
| `spo2_percentage` | `spo2` | Store raw |
| `strain` | `whoopStrain` | Store raw |
| — | `soreness` | Default: 5 (neutral) |
| — | `stressLevel` | Default: 5 (neutral) |
| — | `energyMood` | Default: 5 (neutral) |
| — | `hydration` | Default: "ADEQUATE" |
| — | `injuryStatus` | Default: "NONE" |
| — | `source` | "WHOOP_AUTO" |

Auto check-ins skip the duplicate check (409) — they upsert by (athleteId, date).

### 3.3 ASSISTED Mode Pre-Fill

When athlete opens the check-in form:
1. Check for today's `WhoopDailySnapshot` for their connection
2. If found, pre-fill sleep quality + sleep hours in the form
3. Show WHOOP metrics (HRV, RHR, Recovery %, SpO2) as read-only data pills
4. Athlete fills in subjective fields (soreness, stress, energy, hydration, injury) and submits
5. On submit, the WHOOP metrics are saved alongside the manual data with `source: "WHOOP_ASSISTED"`

### 3.4 Fallback Cron (Safety Net)

`GET /api/cron/whoop-sync` (protected by CRON_SECRET)

Runs daily at 8am UTC. For each `WhoopConnection` where `lastSyncAt` is older than 20 hours:
1. Fetch latest recovery + sleep
2. Store snapshot
3. If AUTO mode + no check-in exists for today: create one
4. Update `lastSyncAt`

This catches cases where webhooks didn't fire (WHOOP outage, network issue).

---

## 4. Environment Variables

```
WHOOP_CLIENT_ID=<from WHOOP developer portal>
WHOOP_CLIENT_SECRET=<from WHOOP developer portal>
WHOOP_ENCRYPTION_KEY=<32-byte hex string for AES-256-GCM>
WHOOP_WEBHOOK_SECRET=<for webhook verification, if WHOOP provides one>
```

---

## 5. UI — Athlete Side

### 5.1 Settings — Integrations Section

In athlete settings page, add an "Integrations" section:

**Disconnected state:**
- WHOOP card with strap icon
- "Connect your WHOOP strap to automatically sync recovery, sleep, and HRV data."
- "Connect WHOOP" button → redirects to `/api/whoop/authorize`

**Connected state:**
- Green "Connected" badge + WHOOP user name
- Last sync time
- Sync mode toggle: `Auto` / `Assisted` (segmented control, same style as Coach/Training toggle)
  - Auto: "Check-ins created automatically from WHOOP data each morning"
  - Assisted: "WHOOP data pre-fills your check-in form — you review and submit"
- "Disconnect" button (danger variant, with confirm dialog)

### 5.2 Check-In Form Enhancement (ASSISTED Mode)

When WHOOP snapshot exists for today:
- Amber banner at top: "WHOOP recovery data available" with strap icon
- `sleepQuality` and `sleepHours` fields pre-filled (editable)
- Below the form: read-only metric pills in a horizontal row:
  - Recovery: `{score}%` (colored green/amber/red by range)
  - HRV: `{hrv}ms`
  - RHR: `{rhr}bpm`
  - SpO2: `{spo2}%` (if available)
- On submit, these values are saved to the check-in's new fields

### 5.3 Check-In Form (AUTO Mode)

If auto check-in already exists for today:
- Show the existing result card (same UI as current)
- Add a "WHOOP" source badge (small strap icon + "Auto" text)
- "Edit Check-In" button allows athlete to modify subjective fields (soreness, stress, energy, injury)

### 5.4 Readiness Display Enhancements

Wherever readiness scores appear (wellness page, dashboard), if WHOOP data is present:
- Show additional compact pills: HRV, RHR below the main score
- Small WHOOP icon badge on the check-in card to indicate data source

---

## 6. UI — Coach Side

Minimal changes — WHOOP data flows through existing readiness queries:

- On athlete detail readiness tab: HRV and RHR appear as additional trend lines in charts (if data exists)
- On roster: small WHOOP icon next to athletes who have a connected strap
- Coach cannot initiate or manage WHOOP connections — athlete-driven only

---

## 7. API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/whoop/authorize` | GET | Generate OAuth URL, redirect to WHOOP |
| `/api/whoop/callback` | GET | Handle OAuth callback, exchange code, create connection |
| `/api/whoop/webhook` | POST | Receive WHOOP webhook events |
| `/api/whoop/disconnect` | POST | Revoke access, delete connection |
| `/api/whoop/sync` | POST | Manual sync trigger for authenticated athlete |
| `/api/cron/whoop-sync` | GET | Daily fallback sync (protected by CRON_SECRET) |

---

## 8. Security

- **Token encryption**: AES-256-GCM with `WHOOP_ENCRYPTION_KEY`. Tokens encrypted before DB storage, decrypted only in-memory when making API calls.
- **Webhook verification**: Validate webhook requests are from WHOOP (signature verification if supported, or IP allowlist).
- **State parameter**: OAuth `state` parameter prevents CSRF on the callback.
- **Scope minimization**: Only request scopes we actually use.
- **Token refresh**: Automatic refresh before expiry. If refresh fails, mark connection as stale and prompt athlete to reconnect.

---

## 9. What We're NOT Building (YAGNI)

- No workout data sync (WHOOP workout strain not actionable for throws coaching yet)
- No historical backfill (sync from connection date forward only)
- No coach-initiated connections (athlete must connect their own device)
- No dedicated WHOOP data visualization page (data flows into existing readiness views)
- No multi-device support (one WHOOP per athlete)
- No Apple Watch / Garmin / Fitbit (separate integrations for the future)
- No WHOOP data in the coaching actions system (recovery score feeds into existing readiness thresholds naturally)

---

## 10. Migration

Single migration: `add-whoop-integration`

```sql
-- WhoopConnection table
CREATE TABLE "WhoopConnection" ( ... );

-- WhoopDailySnapshot table
CREATE TABLE "WhoopDailySnapshot" ( ... );

-- Add fields to ReadinessCheckIn
ALTER TABLE "ReadinessCheckIn" ADD COLUMN "hrvMs" DOUBLE PRECISION;
ALTER TABLE "ReadinessCheckIn" ADD COLUMN "restingHR" DOUBLE PRECISION;
ALTER TABLE "ReadinessCheckIn" ADD COLUMN "spo2" DOUBLE PRECISION;
ALTER TABLE "ReadinessCheckIn" ADD COLUMN "whoopStrain" DOUBLE PRECISION;
ALTER TABLE "ReadinessCheckIn" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';
```

No data loss. All existing check-ins get `source: "MANUAL"` by default.
