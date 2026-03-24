import prisma from "@/lib/prisma";
import { encrypt, decrypt } from "./crypto";

const BASE_URL = "https://api.ouraring.com";
const TOKEN_URL = "https://api.ouraring.com/oauth/token";

// ─── Token Management ─────────────────────────────────────────────────────────

/**
 * Returns a valid access token for the given OuraConnection.
 * Automatically refreshes if the token has expired.
 */
export async function getAccessToken(connectionId: string): Promise<string> {
  const connection = await prisma.ouraConnection.findUniqueOrThrow({
    where: { id: connectionId },
  });

  const decryptedAccess = decrypt(connection.accessToken);

  // If token is still valid (with 60s buffer), return it
  if (connection.tokenExpiresAt.getTime() > Date.now() + 60_000) {
    return decryptedAccess;
  }

  // Token expired — refresh
  if (!connection.refreshToken) {
    return decryptedAccess;
  }

  const decryptedRefresh = decrypt(connection.refreshToken);
  if (!decryptedRefresh) {
    return decryptedAccess;
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptedRefresh,
      client_id: process.env.OURA_CLIENT_ID!,
      client_secret: process.env.OURA_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new Error("Your Oura Ring authorization has expired. Please disconnect and reconnect Oura Ring in Settings.");
    }
    throw new Error(`Oura token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  const newAccess = data.access_token as string;
  const newRefresh = (data.refresh_token as string | undefined);
  const expiresIn = (data.expires_in ?? 86400) as number;

  const newAccessToken = encrypt(newAccess);
  const newRefreshToken = newRefresh ? encrypt(newRefresh) : connection.refreshToken;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  await prisma.ouraConnection.update({
    where: { id: connectionId },
    data: {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      tokenExpiresAt: expiresAt,
    },
  });

  return newAccess;
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function ouraGet(connectionId: string, path: string): Promise<Record<string, unknown>> {
  const token = await getAccessToken(connectionId);
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new Error("Your Oura Ring authorization has expired. Please disconnect and reconnect Oura Ring in Settings.");
    }
    throw new Error(`Oura API ${path} failed (${res.status}): ${text}`);
  }

  return res.json();
}

// ─── Data Fetchers ────────────────────────────────────────────────────────────

export interface OuraReadiness {
  readinessScore: number | null;
  temperatureDeviation: number | null;
}

export async function fetchReadiness(connectionId: string): Promise<OuraReadiness> {
  const today = new Date().toISOString().slice(0, 10);
  const data = await ouraGet(connectionId, `/v2/usercollection/daily_readiness?start_date=${today}&end_date=${today}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records = (data as any)?.data;
  if (!records || records.length === 0) {
    return { readinessScore: null, temperatureDeviation: null };
  }

  return {
    readinessScore: records[0]?.score ?? null,
    temperatureDeviation: records[0]?.temperature_deviation ?? null,
  };
}

export interface OuraSleep {
  sleepScore: number | null;
  sleepDurationSec: number | null;
  sleepEfficiency: number | null;
  lightSleepSec: number | null;
  deepSleepSec: number | null;
  remSleepSec: number | null;
  hrvMs: number | null;
  restingHR: number | null;
}

export async function fetchSleep(connectionId: string): Promise<OuraSleep> {
  const today = new Date().toISOString().slice(0, 10);

  // Fetch both daily_sleep (score) and sleep (detailed stages)
  const [dailySleepData, detailedSleepData] = await Promise.all([
    ouraGet(connectionId, `/v2/usercollection/daily_sleep?start_date=${today}&end_date=${today}`),
    ouraGet(connectionId, `/v2/usercollection/sleep?start_date=${today}&end_date=${today}`),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dailyRecords = (dailySleepData as any)?.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detailedRecords = (detailedSleepData as any)?.data;
  const daily = dailyRecords?.[dailyRecords.length - 1];
  const detailed = detailedRecords?.[detailedRecords.length - 1];

  return {
    sleepScore: daily?.score ?? null,
    sleepDurationSec: detailed?.total_sleep_duration ?? null,
    sleepEfficiency: detailed?.efficiency ?? null,
    lightSleepSec: detailed?.light ?? null,
    deepSleepSec: detailed?.deep ?? null,
    remSleepSec: detailed?.rem ?? null,
    hrvMs: detailed?.average_hrv ?? null,
    restingHR: detailed?.hr_lowest ?? null,
  };
}

export interface OuraActivity {
  activityScore: number | null;
  steps: number | null;
}

export async function fetchActivity(connectionId: string): Promise<OuraActivity> {
  const today = new Date().toISOString().slice(0, 10);
  const data = await ouraGet(connectionId, `/v2/usercollection/daily_activity?start_date=${today}&end_date=${today}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records = (data as any)?.data;
  if (!records || records.length === 0) {
    return { activityScore: null, steps: null };
  }

  return {
    activityScore: records[0]?.score ?? null,
    steps: records[0]?.steps ?? null,
  };
}

export interface OuraSpo2 {
  spo2: number | null;
}

export async function fetchSpo2(connectionId: string): Promise<OuraSpo2> {
  const today = new Date().toISOString().slice(0, 10);
  const data = await ouraGet(connectionId, `/v2/usercollection/daily_spo2?start_date=${today}&end_date=${today}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records = (data as any)?.data;
  if (!records || records.length === 0) {
    return { spo2: null };
  }

  return {
    spo2: records[0]?.spo2_percentage?.average ?? null,
  };
}

export interface OuraProfile {
  userId: string;
  email: string;
}

export async function fetchProfile(accessToken: string): Promise<OuraProfile> {
  const res = await fetch(`${BASE_URL}/v2/usercollection/personal_info`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Oura profile fetch failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    userId: data.id,
    email: data.email ?? "",
  };
}
