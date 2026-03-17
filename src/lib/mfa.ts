import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import {
  generateSecret as otpGenerateSecret,
  generateURI,
  verifySync,
} from "otplib";
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

export async function generateMfaSecret(email: string): Promise<{
  secret: string;
  encryptedSecret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}> {
  const secret = otpGenerateSecret();
  const encryptedSecret = encrypt(secret);
  const otpauthUrl = generateURI({
    issuer: "Podium Throws",
    label: email,
    secret,
  });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { secret, encryptedSecret, otpauthUrl, qrCodeDataUrl };
}

// ---------------------------------------------------------------------------
// TOTP Verification
// ---------------------------------------------------------------------------

export function verifyTotpToken(
  encryptedSecret: string,
  token: string
): boolean {
  const secret = decrypt(encryptedSecret);
  // verifySync returns { valid, delta, epoch, timeStep }
  const result = verifySync({ secret, token });
  return result.valid;
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
  return jwt.sign(
    { userId, purpose: "mfa" } as MfaSessionPayload,
    JWT_SECRET,
    { expiresIn: MFA_TOKEN_EXPIRY }
  );
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
