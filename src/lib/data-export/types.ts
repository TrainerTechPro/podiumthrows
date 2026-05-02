/**
 * Schema-versioned envelope for the user data export. `_meta.schemaVersion`
 * is a contract — bump it when the shape of `data` changes in a
 * non-additive way so downstream consumers can detect breaks.
 */

export const EXPORT_SCHEMA_VERSION = 1;

export interface ExportMeta {
  exportedAt: string;
  userId: string;
  role: "COACH" | "ATHLETE";
  schemaVersion: number;
  signedUrlExpiresAt: string | null;
}

export interface ExportEnvelope<T> {
  _meta: ExportMeta;
  data: T;
}

/** Names of fields the redactor strips wherever they appear. */
export const REDACTED_FIELD_NAMES = new Set<string>([
  "passwordHash",
  "accessToken",
  "refreshToken",
  "mfaSecret",
  "mfaBackupCodes",
  "stripeCustomerId",
  "stripeSubscriptionId",
]);

/**
 * Defensive regex that catches future field additions matching common
 * sensitive-name patterns (e.g. `apiToken`, `webhookSecret`). The redactor
 * logs every regex hit so we can audit retroactively.
 */
export const REDACTED_FIELD_PATTERN = /(?:^|[A-Z])(token|secret|hash)$/i;
