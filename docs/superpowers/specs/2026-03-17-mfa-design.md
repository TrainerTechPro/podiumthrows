# MFA for Coaches — Design Spec

**Date:** 2026-03-17
**Status:** Approved
**Scope:** TOTP-based multi-factor authentication for coach accounts only

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Secret storage | AES-256-GCM encryption | Coaches manage athlete data, pay $100+/month. DB compromise without key = secrets safe. |
| MFA session token | Short-lived JWT (5 min) | No new DB table. Self-cleaning on expiry. Consistent with existing JWT patterns. |
| Backup codes | bcrypt-hashed, one-time use | Same approach as password hashing. Removed from array after use. |

## Schema Changes

Three fields added to `CoachProfile`:

```prisma
mfaSecret      String?    // AES-256-GCM encrypted TOTP secret
mfaEnabled     Boolean    @default(false)
mfaBackupCodes String[]   // bcrypt-hashed backup codes
```

No new tables or enums.

## New Environment Variable

- `MFA_ENCRYPTION_KEY` — 32-byte hex string (64 hex chars) for AES-256-GCM encryption/decryption of TOTP secrets

## Core Library: `src/lib/mfa.ts`

| Function | Signature | Purpose |
|----------|-----------|---------|
| `encrypt` | `(plaintext: string) => string` | AES-256-GCM encrypt. Returns `iv:authTag:ciphertext` (hex-encoded). |
| `decrypt` | `(ciphertext: string) => string` | AES-256-GCM decrypt. Parses `iv:authTag:ciphertext`. |
| `generateSecret` | `(email: string) => Promise<{ secret, encryptedSecret, otpauthUrl, qrCodeDataUrl }>` | Generates TOTP secret, encrypts it, builds otpauth URL, renders QR code as data URL. |
| `verifyToken` | `(encryptedSecret: string, token: string) => boolean` | Decrypts secret, validates 6-digit TOTP with ±1 time window. |
| `generateBackupCodes` | `() => string[]` | 8 random alphanumeric codes, 8 chars each. Returns plaintext (for one-time display). |
| `hashBackupCode` | `(code: string) => Promise<string>` | bcrypt hash a backup code. |
| `verifyBackupCode` | `(code: string, hash: string) => Promise<boolean>` | bcrypt compare. |
| `signMfaSessionToken` | `(userId: string) => string` | JWT with `{ userId, purpose: "mfa" }`, 5-minute expiry. |
| `verifyMfaSessionToken` | `(token: string) => { userId: string }` | Validates JWT, asserts `purpose === "mfa"`. Throws on invalid/expired. |

## API Routes

### POST `/api/auth/mfa/setup`
- **Auth:** Coach JWT required
- **Action:** Call `generateSecret(email)`, return `{ qrCodeDataUrl, secret }` (secret for manual entry fallback)
- **Rate limit:** 5/min
- **Audit:** Log `mfa_setup_initiated`

### POST `/api/auth/mfa/verify-setup`
- **Auth:** Coach JWT required
- **Body:** `{ token: string }` (6-digit TOTP)
- **Action:** Verify token against stored (temporary) secret. On success: set `mfaEnabled = true`, store `encryptedSecret`, generate + hash backup codes, store hashes, return plaintext backup codes.
- **Rate limit:** 5/min
- **Audit:** Log `mfa_enabled`

### POST `/api/auth/mfa/verify`
- **Auth:** MFA session token (from login response)
- **Body:** `{ mfaSessionToken: string, token: string }` (6-digit TOTP)
- **Action:** Verify MFA session token, look up coach, verify TOTP. On success: issue full JWT + auth cookie.
- **Rate limit:** 5 attempts per IP
- **Audit:** Log `mfa_verified` or `mfa_failed`

### POST `/api/auth/mfa/disable`
- **Auth:** Coach JWT required
- **Body:** `{ password: string, token: string }` (current password + 6-digit TOTP)
- **Action:** Verify password (bcrypt), verify TOTP. On success: clear `mfaSecret`, set `mfaEnabled = false`, clear `mfaBackupCodes`.
- **Rate limit:** 3/min
- **Audit:** Log `mfa_disabled`

### POST `/api/auth/mfa/backup`
- **Auth:** MFA session token
- **Body:** `{ mfaSessionToken: string, code: string }` (8-char backup code)
- **Action:** Verify MFA session token, look up coach, verify backup code against hashed array. On success: remove used code from array, issue full JWT + auth cookie.
- **Rate limit:** 5 attempts per IP
- **Audit:** Log `mfa_backup_used`

## Login Flow Changes

File: `src/app/api/auth/login/route.ts`

After successful password verification:

```
if (coachProfile?.mfaEnabled) {
  const mfaSessionToken = signMfaSessionToken(user.id);
  return NextResponse.json({
    requiresMfa: true,
    mfaSessionToken,
  });
}
// else: issue full JWT as before
```

## UI Pages

### `/coach/settings/security` (MFA management)

File: `src/app/(dashboard)/coach/settings/security/page.tsx`

- Shows current MFA status (enabled/disabled badge)
- **Enable flow:** Button → shows QR code + manual secret → input for first TOTP → on verify: display backup codes with "I've saved these" confirmation
- **Disable flow:** Button → modal requiring current password + TOTP code
- Link from existing settings page
- Matches dark theme: `#0d0c09` bg, `#f59e0b` amber accents, Outfit headings, DM Sans body

### `/login/mfa` (MFA verification during login)

File: `src/app/(auth)/login/mfa/page.tsx`

- 6-digit code input with auto-focus
- Auto-submit on 6th digit entry
- "Use a backup code instead" toggle → switches to single 8-char input
- "Back to login" link (clears MFA session state)
- Error display for invalid codes
- Rate limit feedback

## Security Considerations

- `MFA_ENCRYPTION_KEY` must be set in production; app should fail fast if missing when MFA operations are attempted
- Backup codes are one-time use — removed from the hashed array after successful verification
- MFA session tokens are not stored in cookies — passed explicitly in request body
- All MFA endpoints rate-limited via existing `rateLimit()` helper
- All MFA events recorded in audit log via existing `logAuditEvent()` helper
- TOTP window: ±1 period (30 seconds each) to account for clock drift

## Files Changed

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Add 3 fields to CoachProfile |
| `src/lib/mfa.ts` | New — core MFA logic |
| `src/app/api/auth/mfa/setup/route.ts` | New — setup endpoint |
| `src/app/api/auth/mfa/verify-setup/route.ts` | New — verify setup endpoint |
| `src/app/api/auth/mfa/verify/route.ts` | New — login MFA verification |
| `src/app/api/auth/mfa/disable/route.ts` | New — disable MFA |
| `src/app/api/auth/mfa/backup/route.ts` | New — backup code verification |
| `src/app/api/auth/login/route.ts` | Modified — MFA check after password |
| `src/app/(dashboard)/coach/settings/security/page.tsx` | New — security settings UI |
| `src/app/(auth)/login/mfa/page.tsx` | New — MFA login page |

## Dependencies

- `otplib` — TOTP generation and verification
- `qrcode` — QR code generation as data URL
- Both added as production dependencies
