import Parser from 'rss-parser';
import { supabase } from '../config.js';
import { FEEDS } from './feeds.js';

const parser = new Parser();

const DEFAULT_MAX_ENQUEUE_PER_CYCLE = 6;

/** Max items taken from each feed per cycle (newest first). */
function itemsPerFeed() {
  const n = Number(process.env.RSS_ITEMS_PER_FEED ?? 3);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 50) : 3;
}

/**
 * After dedup, keep only this many freshest URLs (by RSS date) for DB checks + enqueue.
 * Stops pulling 100+ links when daily publish is ~30. Set high only if you need a deep backlog.
 */
function maxCandidatesAfterDedup() {
  const v = process.env.GATEKEEPER_MAX_CANDIDATES;
  if (v === undefined || v === '') return 36;
  const n = parseInt(String(v).trim(), 10);
  if (!Number.isFinite(n) || n < 1) return 36;
  return Math.min(n, 300);
}

/**
 * Max new rows inserted into `jobs` per gatekeeper run.
 * - Omitted / empty: safe default ({@link DEFAULT_MAX_ENQUEUE_PER_CYCLE}).
 * - **-1** explicitly: unlimited (not recommended — queue spam).
 * - **0** or any invalid number: same as default (avoids accidental unlimited when env was `0`).
 */
function maxEnqueuePerCycle() {
  const v = process.env.GATEKEEPER_MAX_ENQUEUE_PER_CYCLE;
  if (v === undefined || v === '') return DEFAULT_MAX_ENQUEUE_PER_CYCLE;
  const n = parseInt(String(v).trim(), 10);
  if (!Number.isFinite(n)) return DEFAULT_MAX_ENQUEUE_PER_CYCLE;
  if (n === -1) return 0;
  if (n < 1) return DEFAULT_MAX_ENQUEUE_PER_CYCLE;
  return Math.min(n, 100);
}

/** If pending jobs >= this, skip enqueue for this cycle (0 = disable). */
function maxPendingBacklogBeforeSkip() {
  const v = process.env.GATEKEEPER_MAX_PENDING_BACKLOG;
  if (v === undefined || v === '') return 35;
  const n = parseInt(String(v).trim(), 10);
  if (!Number.isFinite(n) || n < 0) return 35;
  return n;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Stable article URL for dedup (strip hash, common UTM params). */
export function normalizeArticleUrl(raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!/^https?:\/\//i.test(s)) return '';
  try {
    const u = new URL(s);
    u.hash = '';
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid']) {
      u.searchParams.delete(k);
    }
    return u.toString();
  } catch {
    return s;
  }
}

function looksLikeArticlePath(url) {
  try {
    const p = new URL(url).pathname.toLowerCase();
    if (/\/(tag|tags|topics?|author|search|category)\//i.test(p)) return false;
    if (/\/(page|feed)\/\d+\/?$/i.test(p)) return false;
    return true;
  } catch {
    return false;
  }
}

/** @param {string[]} urls */
async function fetchPublishedUrlSet(urls) {
  const published = new Set();
  if (!urls.length) return published;
  for (const part of chunk(urls, 80)) {
    const { data, error } = await supabase.from('articles').select('source_url').in('source_url', part);
    if (error) {
      console.warn('[GATEKEEPER] articles source_url batch lookup failed:', error.message);
      continue;
    }
    for (const row of data || []) {
      if (row?.source_url) published.add(row.source_url);
    }
  }
  return published;
}

/** URLs already pending or processing (avoid duplicate job rows and noise). */
async function fetchQueuedUrlSet() {
  const queued = new Set();
  const { data, error } = await supabase
    .from('jobs')
    .select('url')
    .in('status', ['pending', 'processing']);
  if (error) {
    console.warn('[GATEKEEPER] jobs queue URL fetch failed:', error.message);
    return queued;
  }
  for (const row of data || []) {
    const u = normalizeArticleUrl(row?.url || '');
    if (u) queued.add(u);
  }
  return queued;
}

/**
 * @typedef {Object} GatekeeperStats
 * @property {boolean} ok
 * @property {number} candidatesTotal
 * @property {number} enqueued
 * @property {number} skippedPublished
 * @property {number} skippedAlreadyQueued
 * @property {number} stuckRecovered
 * @property {string[]} feedFailures
 * @property {boolean} enqueueCapped
 * @property {number} skippedDueToEnqueueCap
 * @property {number} skippedAlreadyInQueue
 * @property {boolean} skippedDueToBacklog
 * @property {number} pendingBacklog
 * @property {number} candidatesBeforeCap
 * @property {number} skippedDueToCandidateCap
 */

/**
 * Pull RSS feeds, enqueue new URLs into `jobs`.
 * Skips URLs already published (`articles.source_url`). Duplicate queue URLs hit unique constraint (23505).
 * @returns {Promise<GatekeeperStats>}
 */
export async function runGatekeeper() {
  console.log('[GATEKEEPER] RSS cycle start…');

  /** @type {GatekeeperStats} */
  const stats = {
    ok: true,
    candidatesTotal: 0,
    enqueued: 0,
    skippedPublished: 0,
    skippedAlreadyQueued: 0,
    stuckRecovered: 0,
    feedFailures: [],
    enqueueCapped: false,
    skippedDueToEnqueueCap: 0,
    skippedAlreadyInQueue: 0,
    skippedDueToBacklog: false,
    pendingBacklog: 0,
    candidatesBeforeCap: 0,
    skippedDueToCandidateCap: 0
  };

  try {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60000).toISOString();
    const { data: stuck, error: stuckErr } = await supabase
      .from('jobs')
      .update({ status: 'pending' })
      .eq('status', 'processing')
      .lte('updated_at', fifteenMinsAgo)
      .select();
    if (stuckErr) {
      console.error('[GATEKEEPER] Stuck-job recovery failed (migration 0003?):', stuckErr.message);
    } else if (stuck?.length) {
      stats.stuckRecovered = stuck.length;
      console.log(`[GATEKEEPER] Recovered ${stuck.length} stuck job(s).`);
    }
  } catch (e) {
    console.error('[GATEKEEPER] Stuck-job recovery exception:', e.message);
  }

  const backlogCap = maxPendingBacklogBeforeSkip();
  if (backlogCap > 0) {
    const { count, error: cntErr } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (cntErr) {
      console.warn('[GATEKEEPER] Pending backlog count failed:', cntErr.message);
    } else {
      const backlog = typeof count === 'number' ? count : 0;
      stats.pendingBacklog = backlog;
      if (backlog >= backlogCap) {
        stats.skippedDueToBacklog = true;
        console.warn(
          `[GATEKEEPER] Pending backlog ${backlog} >= ${backlogCap} (GATEKEEPER_MAX_PENDING_BACKLOG); skipping enqueue this cycle.`
        );
        return stats;
      }
    }
  }

  const queuedUrls = await fetchQueuedUrlSet();

  const perFeed = itemsPerFeed();
  /** @type {{ url: string, source_name: string, pubMs: number }[]} */
  const candidates = [];

  for (const feed of FEEDS) {
    try {
      console.log(`[GATEKEEPER] Fetching ${feed.name}…`);
      const parsed = await parser.parseURL(feed.url);
      const latest = (parsed.items || []).slice(0, perFeed);
      for (const item of latest) {
        const url = normalizeArticleUrl(item.link || '');
        if (!url || !looksLikeArticlePath(url)) continue;
        const pubMs = itemPubMs(item);
        candidates.push({ url, source_name: feed.name, pubMs });
      }
    } catch (err) {
      const msg = `${feed.name}: ${err.message}`;
      stats.feedFailures.push(msg);
      console.error(`[GATEKEEPER] Feed failed ${feed.name}:`, err.message);
    }
  }

  /** Same URL in several feeds → keep newest pubDate */
  const byUrl = new Map();
  for (const c of candidates) {
    const prev = byUrl.get(c.url);
    if (!prev || c.pubMs > prev.pubMs) byUrl.set(c.url, c);
  }
  const merged = [...byUrl.values()].sort(
    (a, b) => b.pubMs - a.pubMs || a.url.localeCompare(b.url)
  );

  const candCap = maxCandidatesAfterDedup();
  stats.candidatesBeforeCap = merged.length;
  const unique = merged.slice(0, candCap);
  stats.skippedDueToCandidateCap = Math.max(0, merged.length - unique.length);
  if (stats.skippedDueToCandidateCap > 0) {
    console.log(
      `[GATEKEEPER] Candidate cap: keeping ${unique.length}/${merged.length} newest (GATEKEEPER_MAX_CANDIDATES=${candCap})`
    );
  }

  stats.candidatesTotal = unique.length;
  const published = await fetchPublishedUrlSet(unique.map((c) => c.url));
  const enqueueCap = maxEnqueuePerCycle();

  for (const { url, source_name } of unique) {
    if (enqueueCap > 0 && stats.enqueued >= enqueueCap) {
      stats.enqueueCapped = true;
      stats.skippedDueToEnqueueCap++;
      continue;
    }
    if (queuedUrls.has(url)) {
      stats.skippedAlreadyInQueue++;
      continue;
    }
    if (published.has(url)) {
      stats.skippedPublished++;
      continue;
    }
    const { error } = await supabase.from('jobs').insert({
      url,
      source_name,
      status: 'pending'
    });
    if (!error) {
      stats.enqueued++;
      console.log(`[GATEKEEPER] Enqueued: ${url}`);
    } else if (error.code === '23505') {
      stats.skippedAlreadyQueued++;
    } else {
      console.error(`[GATEKEEPER] DB error for ${url}:`, error.message);
    }
  }

  const capNote = stats.enqueueCapped
    ? ` enqueue_cap_skipped=${stats.skippedDueToEnqueueCap}(max ${enqueueCap}/cycle)`
    : '';
  const qNote =
    stats.skippedAlreadyInQueue > 0 ? ` already_in_jobs_queue=${stats.skippedAlreadyInQueue}` : '';
  console.log(
    `[GATEKEEPER] Cycle done. candidates=${stats.candidatesTotal} (raw_unique=${stats.candidatesBeforeCap}) enqueued=${stats.enqueued} already_published=${stats.skippedPublished} already_queued=${stats.skippedAlreadyQueued}${qNote}${capNote}`
  );
  return stats;
}

/** @param {{ isoDate?: string, pubDate?: string }} item */
function itemPubMs(item) {
  const raw = item?.isoDate || item?.pubDate;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

if (process.argv[1] && process.argv[1].endsWith('cron.js')) {
  runGatekeeper().then(() => process.exit(0));
}
