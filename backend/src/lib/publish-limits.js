import { supabase } from '../config.js';

function envUInt(name, defaultVal) {
  const v = process.env[name];
  if (v === undefined || v === '') return defaultVal;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n) || n < 0) return defaultVal;
  return n;
}

/**
 * @returns {{ perHour: number, perDay: number, capSleepMs: number }}
 * Use **0** for perHour or perDay to disable that cap (defaults are conservative).
 */
export function publishLimitConfig() {
  return {
    perHour: envUInt('PUBLISH_LIMIT_PER_HOUR', 6),
    perDay: envUInt('PUBLISH_LIMIT_PER_DAY', 28),
    capSleepMs: envUInt('PUBLISH_CAP_SLEEP_MS', 600000)
  };
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
  const { perHour, perDay, capSleepMs } = publishLimitConfig();
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
