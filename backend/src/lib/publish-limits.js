import { supabase } from '../config.js';

function envUInt(name, defaultVal) {
  const v = process.env[name];
  if (v === undefined || v === '') return defaultVal;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n) || n < 0) return defaultVal;
  return n;
}

/**
 * Defaults from .env only (used when DB row missing or as merge base).
 * Product default: **3 publishes per rolling 60 minutes**; **no daily cap** (perDay=0).
 */
export function publishLimitEnvDefaults() {
  return {
    perHour: envUInt('PUBLISH_LIMIT_PER_HOUR', 3),
    perDay: envUInt('PUBLISH_LIMIT_PER_DAY', 0),
    capSleepMs: envUInt('PUBLISH_CAP_SLEEP_MS', 600000)
  };
}

/** @deprecated Use {@link publishLimitEnvDefaults} or {@link getResolvedPublishLimitConfig}. */
export function publishLimitConfig() {
  return publishLimitEnvDefaults();
}

let cache = { at: 0, limits: /** @type {null | { perHour: number, perDay: number, capSleepMs: number }} */ (null) };
const CACHE_MS = 45_000;

export function invalidatePublishLimitsCache() {
  cache = { at: 0, limits: null };
}

/** @returns {Promise<{ per_hour: number, per_day: number, cap_sleep_ms: number } | null>} */
async function fetchPublishLimitsRow() {
  const { data, error } = await supabase
    .from('worker_publish_limits')
    .select('per_hour, per_day, cap_sleep_ms')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    if (/relation|does not exist|schema cache/i.test(error.message || '')) {
      console.warn('[publish-limits] worker_publish_limits table missing — apply migration 0008; using .env only.');
    } else {
      console.warn('[publish-limits] DB read failed:', error.message);
    }
    return null;
  }
  if (!data) return null;
  return {
    per_hour: Number(data.per_hour),
    per_day: Number(data.per_day),
    cap_sleep_ms: Number(data.cap_sleep_ms)
  };
}

/**
 * Effective limits: single DB row (id=1) if present, else .env defaults.
 * Cached ~45s to avoid extra queries on the worker hot path.
 */
export async function getResolvedPublishLimitConfig() {
  const now = Date.now();
  if (cache.limits && now - cache.at < CACHE_MS) {
    return cache.limits;
  }

  const env = publishLimitEnvDefaults();
  const row = await fetchPublishLimitsRow();

  const limits = row
    ? {
        perHour: row.per_hour,
        perDay: row.per_day,
        capSleepMs: row.cap_sleep_ms
      }
    : env;

  cache = { at: now, limits };
  return limits;
}

/** For Telegram /limits: env defaults, DB row, and effective caps (refreshes worker cache). */
export async function getPublishLimitsStatus() {
  const envDefaults = publishLimitEnvDefaults();
  const row = await fetchPublishLimitsRow();
  const effective = row
    ? { perHour: row.per_hour, perDay: row.per_day, capSleepMs: row.cap_sleep_ms }
    : envDefaults;
  cache = { at: Date.now(), limits: effective };
  return { envDefaults, dbRow: row, effective };
}

/**
 * Upsert id=1 with partial fields. Validates ranges; merges with existing row or env defaults.
 * @param {{ perHour?: number, perDay?: number, capSleepMs?: number }} patch
 */
export async function updateWorkerPublishLimits(patch) {
  const env = publishLimitEnvDefaults();
  const existing = (await fetchPublishLimitsRow()) ?? {
    per_hour: env.perHour,
    per_day: env.perDay,
    cap_sleep_ms: env.capSleepMs
  };

  let per_hour = existing.per_hour;
  let per_day = existing.per_day;
  let cap_sleep_ms = existing.cap_sleep_ms;

  if (patch.perHour !== undefined) {
    const n = Number(patch.perHour);
    if (!Number.isFinite(n) || n < 0 || n > 500) {
      throw new Error('perHour must be 0..500 (0 = hourly cap off)');
    }
    per_hour = Math.floor(n);
  }
  if (patch.perDay !== undefined) {
    const n = Number(patch.perDay);
    if (!Number.isFinite(n) || n < 0 || n > 5000) {
      throw new Error('perDay must be 0..5000 (0 = daily cap off)');
    }
    per_day = Math.floor(n);
  }
  if (patch.capSleepMs !== undefined) {
    const n = Number(patch.capSleepMs);
    if (!Number.isFinite(n) || n < 10_000 || n > 3_600_000) {
      throw new Error('capSleepMs must be 10000..3600000 (10s..1h)');
    }
    cap_sleep_ms = Math.floor(n);
  }

  const payload = {
    id: 1,
    per_hour,
    per_day,
    cap_sleep_ms,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from('worker_publish_limits').upsert(payload, { onConflict: 'id' });
  if (error) throw new Error(error.message);
  invalidatePublishLimitsCache();
  return payload;
}

async function countPublishedSince(iso) {
  const { count, error } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')
    .gte('created_at', iso);

  if (error) {
    console.warn('[publish-limits] count query failed:', error.message);
    return null;
  }
  return typeof count === 'number' ? count : 0;
}

/**
 * @returns {Promise<{ exceeded: boolean, reason: string, sleepMs: number }>}
 */
export async function getPublishQuotaExceeded() {
  const { perHour, perDay, capSleepMs } = await getResolvedPublishLimitConfig();
  const now = Date.now();

  if (perDay > 0) {
    const dayStart = new Date(now);
    dayStart.setUTCHours(0, 0, 0, 0);
    const c = await countPublishedSince(dayStart.toISOString());
    if (c != null && c >= perDay) {
      const nextUtcMidnight = new Date(dayStart);
      nextUtcMidnight.setUTCDate(nextUtcMidnight.getUTCDate() + 1);
      const sleepMs = Math.min(Math.max(nextUtcMidnight.getTime() - now, 60_000), 3_600_000);
      return {
        exceeded: true,
        reason: `Daily publish cap reached (${c}/${perDay} since UTC midnight)`,
        sleepMs
      };
    }
  }

  if (perHour > 0) {
    const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const c = await countPublishedSince(hourAgo);
    if (c != null && c >= perHour) {
      return {
        exceeded: true,
        reason: `Hourly rolling publish cap reached (${c}/${perHour} in the last 60 minutes)`,
        sleepMs: capSleepMs
      };
    }
  }

  return { exceeded: false, reason: '', sleepMs: 0 };
}
