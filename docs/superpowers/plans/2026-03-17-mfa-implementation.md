# MFA for Coaches — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add TOTP-based multi-factor authentication so coaches can protect their accounts with an authenticator app.

**Architecture:** Three new fields on `CoachProfile` (no new tables). A shared `src/lib/mfa.ts` handles all crypto (AES-256-GCM encryption of TOTP secrets, bcrypt-hashed backup codes, short-lived MFA JWT). Five new API routes under `/api/auth/mfa/*`. Login route modified to return `requiresMfa` when MFA is enabled. Two new UI pages: `/login/mfa` and `/coach/settings/security`.

**Tech Stack:** Next.js 14.2 App Router, TypeScript, Prisma, `otplib` (TOTP), `qrcode` (QR generation), Node.js `crypto` (AES-256-GCM), `bcryptjs` (backup codes), `jsonwebtoken` (MFA session tokens).

**Spec:** `docs/superpowers/specs/2026-03-17-mfa-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `prisma/schema.prisma` | Modify | Add `mfaSecret`, `mfaEnabled`, `mfaBackupCodes` to CoachProfile |
| `src/lib/mfa.ts` | Create | All MFA crypto: encrypt/decrypt, TOTP generate/verify, backup codes, MFA session tokens |
| `src/lib/api-schemas.ts` | Modify | Add Zod schemas for MFA request bodies |
| `src/app/api/auth/mfa/setup/route.ts` | Create | Generate TOTP secret + QR code |
| `src/app/api/auth/mfa/verify-setup/route.ts` | Create | Verify first TOTP token, enable MFA, return backup codes |
| `src/app/api/auth/mfa/verify/route.ts` | Create | Verify TOTP during login, issue full JWT |
| `src/app/api/auth/mfa/disable/route.ts` | Create | Disable MFA (requires password + TOTP) |
| `src/app/api/auth/mfa/backup/route.ts` | Create | Verify backup code during login, issue full JWT |
| `src/app/api/auth/login/route.ts` | Modify | After password check, return `requiresMfa` if MFA enabled |
| `src/app/(auth)/login/page.tsx` | Modify | Handle `requiresMfa` response, redirect to `/login/mfa` |
| `src/app/(auth)/login/mfa/page.tsx` | Create | MFA code entry page during login flow |
| `src/app/(dashboard)/coach/settings/security/page.tsx` | Create | MFA setup/disable UI for coach settings |

---

## Chunk 1: Dependencies, Schema, Core Library

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install otplib and qrcode**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws/.claude/worktrees/festive-lamport"
npm install otplib qrcode @types/qrcode
```

`otplib` is the TOTP library. `qrcode` generates QR code data URLs. `@types/qrcode` provides TypeScript types.

- [ ] **Step 2: Verify installation**

```bash
node -e "require('otplib'); require('qrcode'); console.log('OK')"
```

Expected: `OK`

---

### Task 2: Schema Changes

**Files:**
- Modify: `prisma/schema.prisma` (lines ~147-187, inside `model CoachProfile`)

- [ ] **Step 1: Add MFA fields to CoachProfile**

In `prisma/schema.prisma`, add these three fields inside the `CoachProfile` model, after the `onboardingCompletedAt` field and before the `// Core relations` comment:

```prisma
  // MFA (multi-factor authentication)
  mfaSecret        String?   // AES-256-GCM encrypted TOTP secret
  mfaEnabled       Boolean   @default(false)
  mfaBackupCodes   String[]  // bcrypt-hashed one-time backup codes
```

- [ ] **Step 2: Generate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` success message.

- [ ] **Step 3: Commit schema + deps**

```bash
git add prisma/schema.prisma package.json package-lock.json
git commit -m "feat(mfa): add schema fields and install otplib/qrcode"
```

---

### Task 3: Core MFA Library

**Files:**
- Create: `src/lib/mfa.ts`

This is the largest single file. It contains all MFA crypto operations. Zero Prisma imports — all DB operations happen in the API routes that call these functions.

- [ ] **Step 1: Create `src/lib/mfa.ts`**

```typescript
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import QRCode from "qrcode";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const MFA_TOKEN_EXPIRY = 5 * 60; // 5 minutes

function getEncryptionKey(): Buffer {
  const hex = process.env.MFA_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "MFA_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(hex, "hex");
}

// ---------------------------------------------------------------------------
// AES-256-GCM Encryption
// ---------------------------------------------------------------------------

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:ciphertext (all hex-encoded)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(":");
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Invalid encrypted format");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

// ---------------------------------------------------------------------------
// TOTP Secret Generation
// ---------------------------------------------------------------------------

export async function generateSecret(email: string): Promise<{
  secret: string;
  encryptedSecret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}> {
  const secret = authenticator.generateSecret();
  const encryptedSecret = encrypt(secret);
  const otpauthUrl = authenticator.keyuri(email, "Podium Throws", secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { secret, encryptedSecret, otpauthUrl, qrCodeDataUrl };
}

// ---------------------------------------------------------------------------
// TOTP Verification
// ---------------------------------------------------------------------------

export function verifyToken(encryptedSecret: string, token: string): boolean {
  const secret = decrypt(encryptedSecret);
  // ±1 time window (30s each) to account for clock drift
  return authenticator.check(token, secret);
}

// ---------------------------------------------------------------------------
// Backup Codes
// ---------------------------------------------------------------------------

const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_LENGTH = 8;
const BACKUP_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity

export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    let code = "";
    const bytes = crypto.randomBytes(BACKUP_CODE_LENGTH);
    for (let j = 0; j < BACKUP_CODE_LENGTH; j++) {
      code += BACKUP_CODE_CHARS[bytes[j] % BACKUP_CODE_CHARS.length];
    }
    codes.push(code);
  }
  return codes;
}

export async function hashBackupCode(code: string): Promise<string> {
  return bcrypt.hash(code.toUpperCase().replace(/\s/g, ""), 10);
}

export async function verifyBackupCode(
  code: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(code.toUpperCase().replace(/\s/g, ""), hash);
}

// ---------------------------------------------------------------------------
// MFA Session Tokens (short-lived JWT for login flow)
// ---------------------------------------------------------------------------

interface MfaSessionPayload {
  userId: string;
  purpose: "mfa";
}

export function signMfaSessionToken(userId: string): string {
  return jwt.sign({ userId, purpose: "mfa" } as MfaSessionPayload, JWT_SECRET, {
    expiresIn: MFA_TOKEN_EXPIRY,
  });
}

export function verifyMfaSessionToken(token: string): { userId: string } {
  const payload = jwt.verify(token, JWT_SECRET) as MfaSessionPayload & {
    exp: number;
  };
  if (payload.purpose !== "mfa") {
    throw new Error("Invalid token purpose");
  }
  return { userId: payload.userId };
}
```

**Key design notes for the implementer:**
- `getEncryptionKey()` throws immediately if the env var is missing/malformed. This is intentional — MFA operations should fail loudly, never silently fall back.
- `authenticator` from `otplib` uses 30-second windows by default with a ±1 step tolerance.
- Backup code characters exclude `0/O/1/I` to avoid user confusion when reading codes.
- `verifyBackupCode` normalizes to uppercase and strips spaces so users can enter codes in any format.
- MFA session tokens use the same `JWT_SECRET` as auth tokens but have a `purpose: "mfa"` claim and 5-minute expiry. `verifyMfaSessionToken` explicitly checks the purpose to prevent using a regular auth JWT as an MFA session token.

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/mfa.ts
git commit -m "feat(mfa): add core MFA library with encryption, TOTP, and backup codes"
```

---

### Task 4: Add MFA Zod Schemas

**Files:**
- Modify: `src/lib/api-schemas.ts`

- [ ] **Step 1: Add MFA schemas**

Add these schemas after the `ResetPasswordSchema` block (around line 32) in `src/lib/api-schemas.ts`:

```typescript
// ── MFA Schemas ────────────────────────────────────────────────────────

export const MfaVerifySetupSchema = z.object({
  token: z.string().length(6, "Code must be exactly 6 digits").regex(/^\d{6}$/, "Code must be 6 digits"),
  encryptedSecret: z.string().min(1, "Secret is required"),
});

export const MfaVerifySchema = z.object({
  mfaSessionToken: z.string().min(1, "MFA session token is required"),
  token: z.string().length(6, "Code must be exactly 6 digits").regex(/^\d{6}$/, "Code must be 6 digits"),
});

export const MfaDisableSchema = z.object({
  password: z.string().min(1, "Password is required"),
  token: z.string().length(6, "Code must be exactly 6 digits").regex(/^\d{6}$/, "Code must be 6 digits"),
});

export const MfaBackupSchema = z.object({
  mfaSessionToken: z.string().min(1, "MFA session token is required"),
  code: z.string().min(1, "Backup code is required"),
});
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/api-schemas.ts
git commit -m "feat(mfa): add Zod validation schemas for MFA endpoints"
```

---

## Chunk 2: API Routes

### Task 5: POST `/api/auth/mfa/setup`

**Files:**
- Create: `src/app/api/auth/mfa/setup/route.ts`

This endpoint generates a TOTP secret and QR code. The encrypted secret is returned to the client and must be sent back with the verification token in `/verify-setup`. Nothing is persisted to the DB yet — that only happens after the user proves they can generate valid codes.

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { generateSecret } from "@/lib/mfa";
import { logAudit, auditRequestInfo } from "@/lib/audit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await rateLimit(`mfa-setup:${ip}`, { maxAttempts: 5, windowMs: 60_000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfter / 1000)) } }
      );
    }

    const { secret, encryptedSecret, qrCodeDataUrl } = await generateSecret(session.email);

    void logAudit({
      userId: session.userId,
      action: "MFA_SETUP_INITIATED",
      ...auditRequestInfo(request),
    });

    return NextResponse.json({ qrCodeDataUrl, secret, encryptedSecret });
  } catch (e) {
    logger.error("MFA setup error", { context: "api", error: e });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/mfa/setup/route.ts
git commit -m "feat(mfa): add POST /api/auth/mfa/setup endpoint"
```

---

### Task 6: POST `/api/auth/mfa/verify-setup`

**Files:**
- Create: `src/app/api/auth/mfa/verify-setup/route.ts`

This endpoint verifies the user's first TOTP token to confirm they successfully configured their authenticator app. On success, it enables MFA, stores the encrypted secret, generates backup codes, and returns the plaintext codes (one-time display).

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import prisma from "@/lib/prisma";
import { verifyToken, generateBackupCodes, hashBackupCode } from "@/lib/mfa";
import { parseBody, MfaVerifySetupSchema } from "@/lib/api-schemas";
import { logAudit, auditRequestInfo } from "@/lib/audit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await rateLimit(`mfa-verify-setup:${ip}`, { maxAttempts: 5, windowMs: 60_000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfter / 1000)) } }
      );
    }

    const parsed = await parseBody(request, MfaVerifySetupSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { token, encryptedSecret } = parsed;

    // Verify the TOTP token against the encrypted secret from setup
    const valid = verifyToken(encryptedSecret, token);
    if (!valid) {
      return NextResponse.json({ error: "Invalid code. Please try again." }, { status: 400 });
    }

    // Generate and hash backup codes
    const plaintextCodes = generateBackupCodes();
    const hashedCodes = await Promise.all(plaintextCodes.map(hashBackupCode));

    // Enable MFA on the coach profile
    await prisma.coachProfile.update({
      where: { userId: session.userId },
      data: {
        mfaEnabled: true,
        mfaSecret: encryptedSecret,
        mfaBackupCodes: hashedCodes,
      },
    });

    void logAudit({
      userId: session.userId,
      action: "MFA_ENABLED",
      ...auditRequestInfo(request),
    });

    return NextResponse.json({ backupCodes: plaintextCodes });
  } catch (e) {
    logger.error("MFA verify-setup error", { context: "api", error: e });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/mfa/verify-setup/route.ts
git commit -m "feat(mfa): add POST /api/auth/mfa/verify-setup endpoint"
```

---

### Task 7: POST `/api/auth/mfa/verify`

**Files:**
- Create: `src/app/api/auth/mfa/verify/route.ts`

This is the login-flow endpoint. After a coach enters their password and gets back `requiresMfa: true`, the client sends the 6-digit TOTP code along with the MFA session token here. On success, a full auth JWT is issued.

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { signToken, setAuthCookie, setCsrfCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { verifyMfaSessionToken, verifyToken } from "@/lib/mfa";
import { parseBody, MfaVerifySchema } from "@/lib/api-schemas";
import { logAudit, auditRequestInfo } from "@/lib/audit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await rateLimit(`mfa-verify:${ip}`, { maxAttempts: 5, windowMs: 60_000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfter / 1000)) } }
      );
    }

    const parsed = await parseBody(request, MfaVerifySchema);
    if (parsed instanceof NextResponse) return parsed;
    const { mfaSessionToken, token } = parsed;

    // Verify the short-lived MFA session token
    let mfaSession: { userId: string };
    try {
      mfaSession = verifyMfaSessionToken(mfaSessionToken);
    } catch {
      return NextResponse.json(
        { error: "MFA session expired. Please log in again." },
        { status: 401 }
      );
    }

    // Look up user + coach profile
    const user = await prisma.user.findUnique({
      where: { id: mfaSession.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isAdmin: true,
        coachProfile: { select: { mfaSecret: true, mfaEnabled: true } },
      },
    });

    if (!user || !user.coachProfile?.mfaEnabled || !user.coachProfile.mfaSecret) {
      return NextResponse.json({ error: "MFA not configured" }, { status: 400 });
    }

    // Verify the TOTP token
    const valid = verifyToken(user.coachProfile.mfaSecret, token);
    if (!valid) {
      void logAudit({
        userId: user.id,
        action: "MFA_VERIFY_FAILED",
        metadata: { reason: "invalid_totp" },
        ...auditRequestInfo(request),
      });
      return NextResponse.json({ error: "Invalid code. Please try again." }, { status: 400 });
    }

    // Issue full JWT
    const authToken = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      ...(user.isAdmin ? { isAdmin: true } : {}),
    });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, role: user.role },
      redirectTo: "/coach/dashboard",
    });

    response.headers.append("Set-Cookie", setAuthCookie(authToken));
    response.headers.append("Set-Cookie", setCsrfCookie());

    void logAudit({
      userId: user.id,
      action: "MFA_VERIFIED",
      ...auditRequestInfo(request),
    });

    return response;
  } catch (e) {
    logger.error("MFA verify error", { context: "api", error: e });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/mfa/verify/route.ts
git commit -m "feat(mfa): add POST /api/auth/mfa/verify endpoint for login flow"
```

---

### Task 8: POST `/api/auth/mfa/disable`

**Files:**
- Create: `src/app/api/auth/mfa/disable/route.ts`

Requires both current password AND a valid TOTP code to disable MFA. This prevents disabling MFA if the account is compromised via session hijacking alone.

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { verifyToken } from "@/lib/mfa";
import { parseBody, MfaDisableSchema } from "@/lib/api-schemas";
import { logAudit, auditRequestInfo } from "@/lib/audit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await rateLimit(`mfa-disable:${ip}`, { maxAttempts: 3, windowMs: 60_000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfter / 1000)) } }
      );
    }

    const parsed = await parseBody(request, MfaDisableSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { password, token } = parsed;

    // Get user with password hash and coach MFA fields
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        passwordHash: true,
        coachProfile: { select: { id: true, mfaSecret: true, mfaEnabled: true } },
      },
    });

    if (!user || !user.coachProfile?.mfaEnabled || !user.coachProfile.mfaSecret) {
      return NextResponse.json({ error: "MFA is not enabled" }, { status: 400 });
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    // Verify TOTP
    const valid = verifyToken(user.coachProfile.mfaSecret, token);
    if (!valid) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    // Disable MFA
    await prisma.coachProfile.update({
      where: { id: user.coachProfile.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: [],
      },
    });

    void logAudit({
      userId: user.id,
      action: "MFA_DISABLED",
      ...auditRequestInfo(request),
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    logger.error("MFA disable error", { context: "api", error: e });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/mfa/disable/route.ts
git commit -m "feat(mfa): add POST /api/auth/mfa/disable endpoint"
```

---

### Task 9: POST `/api/auth/mfa/backup`

**Files:**
- Create: `src/app/api/auth/mfa/backup/route.ts`

Login-flow endpoint for backup code verification. Similar to `/verify` but uses a backup code instead of TOTP. The used backup code is removed from the hashed array.

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { signToken, setAuthCookie, setCsrfCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { verifyMfaSessionToken, verifyBackupCode } from "@/lib/mfa";
import { parseBody, MfaBackupSchema } from "@/lib/api-schemas";
import { logAudit, auditRequestInfo } from "@/lib/audit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await rateLimit(`mfa-backup:${ip}`, { maxAttempts: 5, windowMs: 60_000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfter / 1000)) } }
      );
    }

    const parsed = await parseBody(request, MfaBackupSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { mfaSessionToken, code } = parsed;

    // Verify MFA session token
    let mfaSession: { userId: string };
    try {
      mfaSession = verifyMfaSessionToken(mfaSessionToken);
    } catch {
      return NextResponse.json(
        { error: "MFA session expired. Please log in again." },
        { status: 401 }
      );
    }

    // Look up user + coach profile with backup codes
    const user = await prisma.user.findUnique({
      where: { id: mfaSession.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isAdmin: true,
        coachProfile: {
          select: { id: true, mfaEnabled: true, mfaBackupCodes: true },
        },
      },
    });

    if (!user || !user.coachProfile?.mfaEnabled) {
      return NextResponse.json({ error: "MFA not configured" }, { status: 400 });
    }

    // Check each hashed backup code
    const hashedCodes = user.coachProfile.mfaBackupCodes;
    let matchedIndex = -1;

    for (let i = 0; i < hashedCodes.length; i++) {
      const match = await verifyBackupCode(code, hashedCodes[i]);
      if (match) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex === -1) {
      void logAudit({
        userId: user.id,
        action: "MFA_BACKUP_FAILED",
        ...auditRequestInfo(request),
      });
      return NextResponse.json({ error: "Invalid backup code" }, { status: 400 });
    }

    // Remove the used backup code
    const remainingCodes = [...hashedCodes];
    remainingCodes.splice(matchedIndex, 1);

    await prisma.coachProfile.update({
      where: { id: user.coachProfile.id },
      data: { mfaBackupCodes: remainingCodes },
    });

    // Issue full JWT
    const authToken = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      ...(user.isAdmin ? { isAdmin: true } : {}),
    });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, role: user.role },
      redirectTo: "/coach/dashboard",
      remainingBackupCodes: remainingCodes.length,
    });

    response.headers.append("Set-Cookie", setAuthCookie(authToken));
    response.headers.append("Set-Cookie", setCsrfCookie());

    void logAudit({
      userId: user.id,
      action: "MFA_BACKUP_USED",
      metadata: { remainingCodes: remainingCodes.length },
      ...auditRequestInfo(request),
    });

    return response;
  } catch (e) {
    logger.error("MFA backup verify error", { context: "api", error: e });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/mfa/backup/route.ts
git commit -m "feat(mfa): add POST /api/auth/mfa/backup endpoint for backup code login"
```

---

## Chunk 3: Login Flow Modifications

### Task 10: Modify Login Route

**Files:**
- Modify: `src/app/api/auth/login/route.ts`

After the password verification succeeds, check if the coach has MFA enabled. If so, return `requiresMfa: true` with a short-lived MFA session token instead of the full JWT.

- [ ] **Step 1: Add MFA import**

Add to the imports at the top of `src/app/api/auth/login/route.ts`:

```typescript
import { signMfaSessionToken } from "@/lib/mfa";
```

- [ ] **Step 2: Expand the user query to include coach MFA status**

Replace the existing `prisma.user.findUnique` call (around line 25-28):

```typescript
// OLD:
const user = await prisma.user.findUnique({
  where: { email: email.toLowerCase().trim() },
  select: { id: true, email: true, role: true, passwordHash: true, isAdmin: true },
});

// NEW:
const user = await prisma.user.findUnique({
  where: { email: email.toLowerCase().trim() },
  select: {
    id: true,
    email: true,
    role: true,
    passwordHash: true,
    isAdmin: true,
    coachProfile: { select: { mfaEnabled: true } },
  },
});
```

- [ ] **Step 3: Add MFA check after password verification**

After the `passwordValid` check block (after line 50, before the `signToken` call), insert:

```typescript
    // MFA check — coaches with MFA enabled get a short-lived token instead of full JWT
    if (user.role === "COACH" && user.coachProfile?.mfaEnabled) {
      const mfaSessionToken = signMfaSessionToken(user.id);

      void logAudit({
        userId: user.id,
        action: "MFA_REQUIRED",
        metadata: { email: user.email },
        ...reqInfo,
      });

      return NextResponse.json({ requiresMfa: true, mfaSessionToken });
    }
```

- [ ] **Step 4: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/login/route.ts
git commit -m "feat(mfa): add MFA check to login flow, return mfaSessionToken when enabled"
```

---

### Task 11: Modify Login Page

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

The login page needs to handle the `requiresMfa` response by redirecting to `/login/mfa` with the MFA session token passed via URL search params.

- [ ] **Step 1: Update the handleSubmit response handler**

In the `handleSubmit` function, replace the success handling block (the code after `if (!res.ok)` check, around lines 38-44):

```typescript
// OLD:
      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      router.push(redirect || data.redirectTo);

// NEW:
      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      // MFA required — redirect to MFA verification page
      if (data.requiresMfa) {
        const params = new URLSearchParams({ token: data.mfaSessionToken });
        if (redirect) params.set("redirect", redirect);
        router.push(`/login/mfa?${params.toString()}`);
        return;
      }

      router.push(redirect || data.redirectTo);
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(auth)/login/page.tsx"
git commit -m "feat(mfa): handle requiresMfa response in login page, redirect to /login/mfa"
```

---

### Task 12: Create MFA Login Page

**Files:**
- Create: `src/app/(auth)/login/mfa/page.tsx`

This page shows a 6-digit TOTP input during the login flow. It reads the `mfaSessionToken` from URL search params and sends it with the TOTP code to `/api/auth/mfa/verify`. Has a toggle to switch to backup code entry mode.

- [ ] **Step 1: Create the page**

```tsx
"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { csrfHeaders } from "@/lib/csrf-client";

export default function MfaLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mfaSessionToken = searchParams.get("token") || "";
  const redirect = searchParams.get("redirect");

  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [backupMode, setBackupMode] = useState(false);
  const [backupCode, setBackupCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first digit on mount
  useEffect(() => {
    if (!backupMode) inputRefs.current[0]?.focus();
  }, [backupMode]);

  // Redirect to login if no token
  useEffect(() => {
    if (!mfaSessionToken) router.replace("/login");
  }, [mfaSessionToken, router]);

  function handleDigitChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);
    setError("");

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5 && newDigits.every((d) => d.length === 1)) {
      submitTotp(newDigits.join(""));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const newDigits = pasted.split("");
      setDigits(newDigits);
      inputRefs.current[5]?.focus();
      submitTotp(pasted);
    }
  }

  async function submitTotp(token: string) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ mfaSessionToken, token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed");
        setDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        setLoading(false);
        return;
      }

      router.push(redirect || data.redirectTo || "/coach/dashboard");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  async function submitBackup(e: FormEvent) {
    e.preventDefault();
    if (!backupCode.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/mfa/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ mfaSessionToken, code: backupCode.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid backup code");
        setLoading(false);
        return;
      }

      router.push(redirect || data.redirectTo || "/coach/dashboard");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="card p-8 max-w-md mx-auto">
      <h2 className="text-display-sm text-center mb-2">Two-Factor Authentication</h2>
      <p className="text-muted text-center text-sm mb-6">
        {backupMode
          ? "Enter one of your backup codes"
          : "Enter the 6-digit code from your authenticator app"}
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-danger-50 dark:bg-danger-500/10 border border-danger-500/20 text-danger-600 dark:text-danger-500 text-sm">
          {error}
        </div>
      )}

      {!backupMode ? (
        <>
          {/* 6-digit TOTP input */}
          <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={loading}
                className="w-12 h-14 text-center text-xl font-mono input"
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setBackupMode(true);
              setError("");
            }}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline block mx-auto mb-4"
          >
            Use a backup code instead
          </button>
        </>
      ) : (
        <>
          {/* Backup code input */}
          <form onSubmit={submitBackup} className="space-y-4 mb-4">
            <input
              type="text"
              value={backupCode}
              onChange={(e) => {
                setBackupCode(e.target.value.toUpperCase());
                setError("");
              }}
              className="input text-center font-mono tracking-widest"
              placeholder="XXXX XXXX"
              autoFocus
              disabled={loading}
            />
            <button type="submit" disabled={loading || !backupCode.trim()} className="btn-primary w-full">
              {loading ? "Verifying..." : "Verify Backup Code"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setBackupMode(false);
              setBackupCode("");
              setError("");
            }}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline block mx-auto mb-4"
          >
            Use authenticator app instead
          </button>
        </>
      )}

      <Link
        href="/login"
        className="text-sm text-muted hover:text-foreground block text-center"
      >
        Back to login
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(auth)/login/mfa/page.tsx"
git commit -m "feat(mfa): add MFA verification page for login flow"
```

---

## Chunk 4: Settings UI & Finalization

### Task 13: Create Security Settings Page

**Files:**
- Create: `src/app/(dashboard)/coach/settings/security/page.tsx`

This page manages MFA setup and disabling. It has three states:
1. **MFA disabled** — shows "Enable MFA" button
2. **Setup in progress** — shows QR code + verification input
3. **MFA enabled** — shows status badge + "Disable MFA" button

- [ ] **Step 1: Create the page**

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { csrfHeaders } from "@/lib/csrf-client";
import { useToast } from "@/components/toast";

type Phase = "loading" | "disabled" | "setup-qr" | "setup-verify" | "backup-codes" | "enabled";

export default function SecuritySettingsPage() {
  const { addToast } = useToast();
  const [phase, setPhase] = useState<Phase>("loading");
  const [mfaEnabled, setMfaEnabled] = useState(false);

  // Setup state
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [encryptedSecret, setEncryptedSecret] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // Disable state
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setupCodeRef = useRef<HTMLInputElement>(null);

  // Fetch MFA status on mount
  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/coach/profile");
        if (res.ok) {
          const data = await res.json();
          const enabled = data.profile?.mfaEnabled ?? false;
          setMfaEnabled(enabled);
          setPhase(enabled ? "enabled" : "disabled");
        } else {
          setPhase("disabled");
        }
      } catch {
        setPhase("disabled");
      }
    }
    fetchStatus();
  }, []);

  async function startSetup() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/mfa/setup", {
        method: "POST",
        headers: { ...csrfHeaders() },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start MFA setup");
        setLoading(false);
        return;
      }
      setQrCodeDataUrl(data.qrCodeDataUrl);
      setManualSecret(data.secret);
      setEncryptedSecret(data.encryptedSecret);
      setPhase("setup-qr");
      setLoading(false);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  async function verifySetup() {
    if (setupCode.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/mfa/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ token: setupCode, encryptedSecret }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed");
        setSetupCode("");
        setupCodeRef.current?.focus();
        setLoading(false);
        return;
      }
      setBackupCodes(data.backupCodes);
      setMfaEnabled(true);
      setPhase("backup-codes");
      setLoading(false);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  async function disableMfa() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ password: disablePassword, token: disableCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to disable MFA");
        setLoading(false);
        return;
      }
      setMfaEnabled(false);
      setShowDisableModal(false);
      setDisablePassword("");
      setDisableCode("");
      setPhase("disabled");
      setLoading(false);
      addToast("Two-factor authentication disabled", "info");
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n")).then(() => {
      addToast("Backup codes copied to clipboard", "success");
    });
  }

  if (phase === "loading") {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-surface-200 dark:bg-surface-700 rounded w-48" />
          <div className="h-32 bg-surface-200 dark:bg-surface-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/coach/settings" className="text-muted hover:text-foreground">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-display-sm">Security</h1>
      </div>

      {/* MFA Section */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold font-display">Two-Factor Authentication</h2>
            <p className="text-sm text-muted mt-1">
              Add an extra layer of security with an authenticator app
            </p>
          </div>
          {mfaEnabled ? (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-success-500/10 text-success-600 dark:text-success-400 border border-success-500/20">
              Enabled
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-surface-200 dark:bg-surface-700 text-muted">
              Disabled
            </span>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-danger-50 dark:bg-danger-500/10 border border-danger-500/20 text-danger-600 dark:text-danger-500 text-sm">
            {error}
          </div>
        )}

        {/* Phase: Disabled */}
        {phase === "disabled" && (
          <button onClick={startSetup} disabled={loading} className="btn-primary">
            {loading ? "Setting up..." : "Enable Two-Factor Authentication"}
          </button>
        )}

        {/* Phase: QR Code Display */}
        {phase === "setup-qr" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.)
            </p>
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCodeDataUrl}
                alt="MFA QR Code"
                className="w-48 h-48 rounded-lg bg-white p-2"
              />
            </div>
            <details className="text-sm">
              <summary className="text-primary-600 dark:text-primary-400 cursor-pointer">
                Can&apos;t scan? Enter this code manually
              </summary>
              <code className="block mt-2 p-3 bg-surface-100 dark:bg-surface-800 rounded-lg font-mono text-sm break-all select-all">
                {manualSecret}
              </code>
            </details>
            <button
              onClick={() => {
                setPhase("setup-verify");
                setTimeout(() => setupCodeRef.current?.focus(), 100);
              }}
              className="btn-primary w-full"
            >
              I&apos;ve scanned the code
            </button>
          </div>
        )}

        {/* Phase: Verify Setup */}
        {phase === "setup-verify" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Enter the 6-digit code from your authenticator app to confirm setup
            </p>
            <div className="flex gap-2">
              <input
                ref={setupCodeRef}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={setupCode}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setSetupCode(v);
                  setError("");
                }}
                className="input font-mono text-center text-lg tracking-widest flex-1"
                placeholder="000000"
                autoFocus
              />
              <button
                onClick={verifySetup}
                disabled={loading || setupCode.length !== 6}
                className="btn-primary"
              >
                {loading ? "Verifying..." : "Verify"}
              </button>
            </div>
            <button
              onClick={() => {
                setPhase("setup-qr");
                setSetupCode("");
                setError("");
              }}
              className="text-sm text-muted hover:text-foreground"
            >
              Back to QR code
            </button>
          </div>
        )}

        {/* Phase: Backup Codes (one-time display) */}
        {phase === "backup-codes" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-warning-50 dark:bg-warning-500/10 border border-warning-500/20">
              <p className="text-sm font-medium text-warning-700 dark:text-warning-400">
                Save these backup codes in a safe place. Each code can only be used once. You won&apos;t be able to see them again.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 p-4 bg-surface-100 dark:bg-surface-800 rounded-lg">
              {backupCodes.map((code, i) => (
                <code key={i} className="font-mono text-sm py-1">
                  {code}
                </code>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={copyBackupCodes} className="btn-secondary flex-1">
                Copy codes
              </button>
              <button
                onClick={() => setPhase("enabled")}
                className="btn-primary flex-1"
              >
                I&apos;ve saved my codes
              </button>
            </div>
          </div>
        )}

        {/* Phase: Enabled */}
        {phase === "enabled" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Your account is protected with two-factor authentication. You&apos;ll need your authenticator app each time you sign in.
            </p>
            <button
              onClick={() => {
                setShowDisableModal(true);
                setError("");
              }}
              className="btn-secondary text-danger-600 dark:text-danger-400 border-danger-500/30 hover:bg-danger-50 dark:hover:bg-danger-500/10"
            >
              Disable Two-Factor Authentication
            </button>
          </div>
        )}
      </div>

      {/* Disable Modal */}
      {showDisableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="card p-6 w-full max-w-md mx-4 space-y-4">
            <h3 className="text-lg font-semibold font-display">Disable Two-Factor Authentication</h3>
            <p className="text-sm text-muted">
              Enter your password and a code from your authenticator app to disable MFA.
            </p>

            {error && (
              <div className="p-3 rounded-xl bg-danger-50 dark:bg-danger-500/10 border border-danger-500/20 text-danger-600 dark:text-danger-500 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                className="input"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="label">Authenticator code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="input font-mono text-center tracking-widest"
                placeholder="000000"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDisableModal(false);
                  setDisablePassword("");
                  setDisableCode("");
                  setError("");
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={disableMfa}
                disabled={loading || !disablePassword || disableCode.length !== 6}
                className="btn-primary flex-1 !bg-danger-600 hover:!bg-danger-700"
              >
                {loading ? "Disabling..." : "Disable MFA"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Note for implementer:** The page fetches MFA status from `/api/coach/profile` which already returns the coach profile. The `mfaEnabled` field will be included automatically since Prisma returns all scalar fields by default.

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/coach/settings/security/page.tsx"
git commit -m "feat(mfa): add security settings page with MFA setup/disable UI"
```

---

### Task 14: Final Verification

- [ ] **Step 1: Run full type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Run linter**

```bash
npx next lint
```

Expected: 0 errors (warnings OK).

- [ ] **Step 3: Final commit (if any lint fixes needed)**

```bash
git add -A
git commit -m "chore(mfa): lint fixes"
```

- [ ] **Step 4: Generate Prisma client for local testing**

```bash
POSTGRES_PRISMA_URL="postgresql://anthonysommers@localhost:5432/podium_throws" POSTGRES_URL_NON_POOLING="postgresql://anthonysommers@localhost:5432/podium_throws" npx prisma db push
```

This pushes the schema changes to the local database.
