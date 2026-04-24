import { createClient, type EdgeConfigClient } from "@vercel/edge-config";

import { logger } from "@/lib/logger";
// ---------------------------------------------------------------------------
// Feature flag definitions
// ---------------------------------------------------------------------------

export type FeatureFlag = {
  enabled: boolean;
  /** Which subscription tiers can access this feature (empty = all tiers) */
  tiers: ("free" | "pro" | "elite")[];
};

export type FlagKey =
  | "selfProgram"
  | "videoAnnotator"
  | "throwsAnalysis"
  | "ouraIntegration"
  | "whoopIntegration"
  | "weeklyDigest"
  | "questionnaireBuilder"
  | "competitionTracking"
  | "practiceMode"
  | "teamManagement";

export type FlagMap = Record<FlagKey, FeatureFlag>;

// Default flags — used when Edge Config is unavailable (local dev)
const DEFAULT_FLAGS: FlagMap = {
  selfProgram: { enabled: true, tiers: ["pro", "elite"] },
  videoAnnotator: { enabled: true, tiers: ["elite"] },
  throwsAnalysis: { enabled: true, tiers: ["pro", "elite"] },
  ouraIntegration: { enabled: true, tiers: ["elite"] },
  whoopIntegration: { enabled: true, tiers: ["elite"] },
  weeklyDigest: { enabled: true, tiers: ["pro", "elite"] },
  questionnaireBuilder: { enabled: true, tiers: ["pro", "elite"] },
  competitionTracking: { enabled: true, tiers: ["pro", "elite"] },
  practiceMode: { enabled: true, tiers: [] },
  teamManagement: { enabled: true, tiers: ["elite"] },
};

// ---------------------------------------------------------------------------
// Edge Config client (singleton)
// ---------------------------------------------------------------------------

let _client: EdgeConfigClient | null = null;

function getClient(): EdgeConfigClient | null {
  if (_client) return _client;
  if (!process.env.EDGE_CONFIG) return null;
  _client = createClient(process.env.EDGE_CONFIG);
  return _client;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get all feature flags. Returns defaults if Edge Config is unavailable.
 * Safe to call from Edge runtime, server components, and API routes.
 */
export async function getFlags(): Promise<FlagMap> {
  const client = getClient();
  if (!client) return DEFAULT_FLAGS;

  try {
    const flags = await client.get<FlagMap>("flags");
    if (!flags) return DEFAULT_FLAGS;
    // Merge with defaults so new flags added in code always have a value
    return { ...DEFAULT_FLAGS, ...flags };
  } catch (err) {
    // Edge Config unavailable — fall back to defaults (log for visibility)
    logger.warn("[flags] Edge Config error — serving default flags", {
      context: "flags",
      error: err,
    });
    return DEFAULT_FLAGS;
  }
}

/**
 * Check if a specific feature is enabled for a given tier.
 * Tier is required to prevent accidentally granting tier-gated features.
 * Use `isFeatureEnabledAnyTier` when the tier check is intentionally skipped.
 */
export async function isFeatureEnabled(
  key: FlagKey,
  tier: "free" | "pro" | "elite"
): Promise<boolean> {
  const flags = await getFlags();
  const flag = flags[key];
  if (!flag || !flag.enabled) return false;
  if (flag.tiers.length === 0) return true;
  return flag.tiers.includes(tier);
}

/**
 * Check if a feature is enabled regardless of tier.
 * Use only when the caller intentionally bypasses tier gating (e.g., admin views).
 */
export async function isFeatureEnabledAnyTier(key: FlagKey): Promise<boolean> {
  const flags = await getFlags();
  const flag = flags[key];
  return !!flag?.enabled;
}

/**
 * Get a single flag value. Returns the default if Edge Config is unavailable.
 */
export async function getFlag(key: FlagKey): Promise<FeatureFlag> {
  const flags = await getFlags();
  return flags[key] ?? DEFAULT_FLAGS[key];
}
