import prisma from "@/lib/prisma";
import { encrypt, decrypt } from "./crypto";

const BASE_URL = "https://api.prod.whoop.com/developer";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

// ─── Token Management ─────────────────────────────────────────────────────────

/**
 * Returns a valid access token for the given WhoopConnection.
 * Automatically refreshes if the token has expired.
 */
export async function getAccessToken(connectionId: string): Promise<string> {
  const connection = await prisma.whoopConnection.findUniqueOrThrow({
    where: { id: connectionId },
  });

  const decryptedAccess = decrypt(connection.accessToken);

  // If token is still valid (with 60s buffer), return it
  if (connection.tokenExpiresAt.getTime() > Date.now() + 60_000) {
    return decryptedAccess;
  }

  // Token expired — refresh
  const decryptedRefresh = decrypt(connection.refreshToken);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptedRefresh,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WHOOP token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  const newAccessToken = encrypt(data.access_token as string);
  const newRefreshToken = encrypt(data.refresh_token as string);
  const expiresAt = new Date(Date.now() + (data.expires_in as number) * 1000);

  await prisma.whoopConnection.update({
    where: { id: connectionId },
    data: {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      tokenExpiresAt: expiresAt,
    },
  });

  return data.access_token as string;
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function whoopGet(connectionId: string, path: string): Promise<Record<string, unknown>> {
  const token = await getAccessToken(connectionId);
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WHOOP API ${path} failed (${res.status}): ${text}`);
  }

  return res.json();
}

// ─── Data Fetchers ────────────────────────────────────────────────────────────

export interface WhoopRecovery {
  recoveryScore: number | null;
  hrvMs: number | null;
  restingHR: number | null;
  spo2: number | null;
  skinTempC: number | null;
}

export async function fetchRecovery(connectionId: string): Promise<WhoopRecovery> {
  const data = await whoopGet(connectionId, "/v2/recovery?limit=1");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records = (data as any)?.records;
  if (!records || records.length === 0) {
    return {
      recoveryScore: null,
      hrvMs: null,
      restingHR: null,
      spo2: null,
      skinTempC: null,
    };
  }

  const score = records[0]?.score;
  return {
    recoveryScore: score?.recovery_score ?? null,
    hrvMs: score?.hrv_rmssd_milli ?? null,
    restingHR: score?.resting_heart_rate ?? null,
    spo2: score?.spo2_percentage ?? null,
    skinTempC: score?.skin_temp_celsius ?? null,
  };
}

export interface WhoopSleep {
  sleepPerformance: number | null;
  sleepDurationMs: number | null;
  sleepEfficiency: number | null;
  lightSleepMs: number | null;
  swsSleepMs: number | null;
  remSleepMs: number | null;
}

export async function fetchSleep(connectionId: string): Promise<WhoopSleep> {
  const data = await whoopGet(connectionId, "/v2/activity/sleep?limit=1");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records = (data as any)?.records;
  if (!records || records.length === 0) {
    return {
      sleepPerformance: null,
      sleepDurationMs: null,
      sleepEfficiency: null,
      lightSleepMs: null,
      swsSleepMs: null,
      remSleepMs: null,
    };
  }

  const score = records[0]?.score;
  const stages = score?.stage_summary;
  return {
    sleepPerformance: score?.sleep_performance_percentage ?? null,
    sleepDurationMs: stages?.total_in_bed_time_milli ?? null,
    sleepEfficiency: score?.sleep_efficiency_percentage ?? null,
    lightSleepMs: stages?.total_light_sleep_time_milli ?? null,
    swsSleepMs: stages?.total_slow_wave_sleep_time_milli ?? null,
    remSleepMs: stages?.total_rem_sleep_time_milli ?? null,
  };
}

export interface WhoopStrain {
  strain: number | null;
}

export async function fetchStrain(connectionId: string): Promise<WhoopStrain> {
  const data = await whoopGet(connectionId, "/v2/cycle?limit=1");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records = (data as any)?.records;
  if (!records || records.length === 0) {
    return { strain: null };
  }

  const score = records[0]?.score;
  return {
    strain: score?.strain ?? null,
  };
}

export interface WhoopProfile {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
}

export async function fetchProfile(accessToken: string): Promise<WhoopProfile> {
  const res = await fetch(`${BASE_URL}/v2/user/profile/basic`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WHOOP profile fetch failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    userId: data.user_id,
    firstName: data.first_name,
    lastName: data.last_name,
    email: data.email,
  };
}
