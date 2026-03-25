/**
 * Shared wearable integration auth utilities.
 *
 * Every wearable integration (WHOOP, Oura, Garmin, etc.) follows the same
 * OAuth2 pattern. These helpers standardize:
 *  - reauth error detection (sync routes)
 *  - token health checks (integrations page)
 *  - error response formatting
 *
 * When adding a new wearable integration:
 *  1. Use `isReauthError(message)` in your sync route's catch block
 *  2. Use `reauthResponse(providerName)` to return the standard 401
 *  3. Use `needsReauth(refreshToken, scopes, offlineScope)` in the integrations page
 *  4. Pass `needsReauth` to your wearable card component
 *  5. Allow re-auth without disconnect in your authorize route (callback does upsert)
 */

/**
 * Detects whether a sync error is an auth/token expiry issue
 * that requires the user to re-authorize.
 */
export function isReauthError(message: string): boolean {
  const patterns = [
    "access token expired",
    "refresh token",
    "authorization has expired",
    "token refresh failed (401)",
    "token refresh failed (403)",
  ];
  const lower = message.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

/**
 * Checks whether a wearable connection needs re-authorization
 * based on its stored refresh token and scopes.
 */
export function needsReauth(
  refreshToken: string | null | undefined,
  scopes: string,
  offlineScope: string
): boolean {
  // Empty or missing refresh token → definitely needs reauth
  if (!refreshToken) return true;
  // Missing offline/refresh scope → token refresh won't work
  if (!scopes.includes(offlineScope)) return true;
  return false;
}
