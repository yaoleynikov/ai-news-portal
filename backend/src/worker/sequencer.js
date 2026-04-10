import { supabase, config } from '../config.js';
import { sendTelegramMessage } from '../lib/telegram.js';
import { runGatekeeper } from '../gatekeeper/cron.js';
import { normalizeArticleUrl } from '../lib/article-url.js';
import { clipSourceForRewriter } from '../lib/rewrite-length-quality.js';
import { extractArticleData } from '../scraper/extractor.js';
import { generateEmbedding } from '../brain/embeddings.js';
import { rewriteArticle } from '../brain/rewriter.js';
import { generateCoverWithFallback } from '../media/generator.js';
import { uploadToR2 } from '../media/uploader.js';
import { insertPublishedArticleRow } from '../lib/slug.js';
import { getPublishQuotaExceeded, getResolvedPublishLimitConfig } from '../lib/publish-limits.js';
import { notifyGoogleUrlUpdated, isGoogleIndexingConfigured } from '../lib/google-indexing.js';
import { startDailyStatsScheduler } from '../stats/daily-report.js';
import { spinTelegramAdminWithWorker } from '../lib/telegram-admin-runtime.js';

/** @returns {Promise<'ok'|'duplicate'|'rpc_error'>} */
async function checkDuplicate(embedding) {
  try {
    const { data, error } = await supabase.rpc('match_articles', {
      query_embedding: `[${embedding.join(',')}]`,
      match_threshold: config.limits.similarityThreshold,
      match_count: 1
    });

    if (error) {
      console.warn('[SEQUENCER] match_articles RPC failed:', error.message);
      return 'rpc_error';
    }

    if (data && data.length > 0) {
      return 'duplicate';
    }
    return 'ok';
  } catch (e) {
    console.warn('[SEQUENCER] match_articles exception:', e.message);
    return 'rpc_error';
  }
}

// Polling interval
const POLL_INTERVAL_MS = 10000;
/** Log a hint if we are idle this many polls while jobs look pending (claim/RPC issue). */
const IDLE_LOG_EVERY_POLLS = 6;

/**
 * PostgREST / composite `RETURNS jobs` rows sometimes arrive as array, nested key, or JSON string.
 * @param {unknown} raw
 * @returns {Record<string, unknown> | null}
 */
function normalizeJobRow(raw) {
  if (raw == null) return null;
  let cur = raw;
  if (Array.isArray(cur)) cur = cur[0];
  if (cur == null || typeof cur !== 'object') {
    if (typeof cur === 'string') {
      try {
        const parsed = JSON.parse(cur);
        return typeof parsed === 'object' && parsed != null ? /** @type {Record<string, unknown>} */ (parsed) : null;
      } catch {
        return null;
      }
    }
    return null;
  }
  const o = /** @type {Record<string, unknown>} */ (cur);
  const nested = o.dequeue_next_job ?? o.jobs;
  if (nested != null && nested !== o) return normalizeJobRow(nested);
  return o;
}

/** Supabase/PostgREST may return a composite `jobs` row with all-null fields when the RPC effectively returns NULL. */
function isClaimableJob(row) {
  if (!row || typeof row !== 'object') return false;
  if (row.id == null || row.id === '') return false;
  const u = typeof row.url === 'string' ? row.url.trim() : '';
  return /^https?:\/\//i.test(u);
}

/** Prefer DB RPC `dequeue_next_job` (migration 0005); fall back if RPC missing. */
async function claimNextJob() {
  const { data: fromRpc, error: rpcErr } = await supabase.rpc('dequeue_next_job');

  if (!rpcErr) {
    const row = normalizeJobRow(fromRpc);
    if (isClaimableJob(row)) return { job: row, mode: 'rpc' };
    return { job: null, mode: 'idle' };
  }

  if (/dequeue_next_job|function.*does not exist|schema cache/i.test(rpcErr.message || '')) {
    console.warn('[SEQUENCER] dequeue_next_job unavailable — using legacy claim (apply migration 0005).');
  } else {
    console.warn('[SEQUENCER] dequeue_next_job error:', rpcErr.message);
  }

  const { data: jobs, error: fetchError } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1);

  if (fetchError || !jobs || jobs.length === 0) {
    return { job: null, mode: 'legacy' };
  }

  const row = jobs[0];
  const { data: updated, error: updErr } = await supabase
    .from('jobs')
    .update({ status: 'processing', attempts: row.attempts + 1 })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select()
    .maybeSingle();

  if (updErr || !updated) {
    if (updErr) console.warn('[SEQUENCER] Legacy claim lost race:', updErr.message);
    return { job: null, mode: 'legacy' };
  }

  if (!isClaimableJob(updated)) {
    console.warn('[SEQUENCER] Legacy claim returned an invalid job row; skipping.');
    return { job: null, mode: 'legacy' };
  }

  return { job: updated, mode: 'legacy' };
}

async function countJobsWithStatus(status) {
  const { count, error } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', status);
  if (error) {
    console.warn('[SEQUENCER] jobs count failed:', error.message);
    return null;
  }
  return typeof count === 'number' ? count : 0;
}

async function countPublishedSinceUtc(iso) {
  const { count, error } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')
    .gte('created_at', iso);
  if (error) {
    console.warn('[SEQUENCER] articles count failed:', error.message);
    return null;
  }
  return typeof count === 'number' ? count : 0;
}

/** Snapshot for startup logs + optional Telegram (single DB round-trip). */
async function fetchStartupQueueSnapshot() {
  const now = Date.now();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const hourAgoIso = new Date(now - 60 * 60 * 1000).toISOString();
  const dayStartIso = dayStart.toISOString();

  const [pending, processing, pubDay, pubHour] = await Promise.all([
    countJobsWithStatus('pending'),
    countJobsWithStatus('processing'),
    countPublishedSinceUtc(dayStartIso),
    countPublishedSinceUtc(hourAgoIso)
  ]);

  return {
    pending,
    processing,
    pubDay,
    pubHour,
    dayStartIso,
    startedAtIso: new Date(now).toISOString()
  };
}

function embeddedGatekeeperSummary() {
  const ms = gatekeeperIntervalMs();
  if (ms <= 0) return 'embedded RSS gatekeeper: off';
  return `embedded RSS gatekeeper: every ${Math.round(ms / 60000)} min`;
}

function escHtmlBrief(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Telegram when the worker process starts. Set TG_WORKER_STARTUP_NOTIFY=0 to disable.
 */
async function sendTelegramWorkerStartup(lim, snap) {
  const off = String(process.env.TG_WORKER_STARTUP_NOTIFY || '')
    .trim()
    .toLowerCase();
  if (off === '0' || off === 'false' || off === 'off') return;

  const token = process.env.TG_BOT_TOKEN?.trim();
  const chatId = process.env.TG_ADMIN_CHAT_ID?.trim();
  if (!token || !chatId) return;

  const dayCap = lim.perDay > 0 ? `${lim.perDay} (UTC day)` : 'off';
  const hourCap = lim.perHour > 0 ? `${lim.perHour} (rolling 60m)` : 'off';

  const lines = [
    '🟢 <b>SiliconFeed worker</b> started',
    '',
    `<b>Queue:</b> pending ${snap.pending ?? '?'}, processing ${snap.processing ?? '?'}`,
    `<b>Published</b> since UTC midnight: ${snap.pubDay ?? '?'} <i>(cap ${escHtmlBrief(dayCap)})</i>`,
    `<b>Published</b> last 60 min: ${snap.pubHour ?? '?'} <i>(cap ${escHtmlBrief(hourCap)})</i>`,
    '',
    `<b>${escHtmlBrief(embeddedGatekeeperSummary())}</b>`,
    `<b>Site:</b> ${escHtmlBrief(config.publicSiteUrl)}`,
    '',
    `<i>${escHtmlBrief(snap.startedAtIso)}</i>`
  ];

  if (lim.perDay > 0 && snap.pubDay != null && snap.pubDay >= lim.perDay) {
    lines.push('', '⚠️ <b>Daily cap already hit</b> — jobs wait until UTC day rolls or cap is raised.');
  } else if (lim.perHour > 0 && snap.pubHour != null && snap.pubHour >= lim.perHour) {
    lines.push('', '⚠️ <b>Hourly cap already hit</b> — worker sleeps until the window moves.');
  }

  try {
    const ok = await sendTelegramMessage(token, chatId, lines.join('\n'), { parseMode: 'HTML' });
    if (!ok) console.warn('[SEQUENCER] Telegram startup notify: sendMessage returned false');
  } catch (e) {
    console.warn('[SEQUENCER] Telegram startup notify failed:', e?.message || e);
  }
}

/** Why the queue can look “dead”: caps block claiming entirely. */
function logStartupDiagnostics(lim, snap) {
  console.log(
    `[SEQUENCER] Queue: pending=${snap.pending ?? '?'} processing=${snap.processing ?? '?'} | ` +
      `published UTC today=${snap.pubDay ?? '?'} (daily cap ${lim.perDay || 'off'}) | ` +
      `last 60m=${snap.pubHour ?? '?'} (hourly cap ${lim.perHour || 'off'})`
  );

  if (lim.perDay > 0 && snap.pubDay != null && snap.pubDay >= lim.perDay) {
    console.warn(
      `[SEQUENCER] Daily publish cap ALREADY hit (${snap.pubDay}/${lim.perDay} since UTC midnight). ` +
        `Worker will not process jobs until tomorrow UTC or you raise the cap (env PUBLISH_LIMIT_PER_DAY / DB worker_publish_limits, or 0=off).`
    );
  }
  if (lim.perHour > 0 && snap.pubHour != null && snap.pubHour >= lim.perHour) {
    console.warn(
      `[SEQUENCER] Hourly cap ALREADY hit (${snap.pubHour}/${lim.perHour} rolling). ` +
        `Worker sleeps until the window moves or cap is raised.`
    );
  }
}

export async function processQueue() {
  const lim = await getResolvedPublishLimitConfig();
  if (lim.perHour > 0 || lim.perDay > 0) {
    const dayStr = lim.perDay > 0 ? `${lim.perDay}/day (UTC midnight)` : 'no daily cap';
    console.log(
      `[SEQUENCER] Publish limits (DB row or .env): ${lim.perHour}/hour (rolling 60m), ${dayStr}. Set cap to 0 to turn that limit off. Telegram: npm run telegram:limits`
    );
  } else {
    console.log('[SEQUENCER] Publish limits: both caps off (unlimited).');
  }
  const startupSnap = await fetchStartupQueueSnapshot();
  logStartupDiagnostics(lim, startupSnap);
  await sendTelegramWorkerStartup(lim, startupSnap);
  console.log('[SEQUENCER] Worker started. Polling for jobs...');

  let idlePolls = 0;

  while (true) {
    let job = null;
    try {
      const quota = await getPublishQuotaExceeded();
      if (quota.exceeded) {
        const sec = Math.ceil(quota.sleepMs / 1000);
        const pend = await countJobsWithStatus('pending');
        console.log(
          `[SEQUENCER] ${quota.reason} — sleeping ${sec}s | pending jobs waiting in DB: ${pend ?? '?'} (they are NOT processed while capped)`
        );
        await new Promise((r) => setTimeout(r, quota.sleepMs));
        continue;
      }

      const { job: claimed, mode: claimMode } = await claimNextJob();
      if (!claimed) {
        idlePolls++;
        if (idlePolls % IDLE_LOG_EVERY_POLLS === 0) {
          const pend = await countJobsWithStatus('pending');
          if (pend != null && pend > 0) {
            console.warn(
              `[SEQUENCER] ${pend} pending job(s) but claim returned none (${claimMode}). ` +
                `Check Supabase migration 0005 (dequeue_next_job), service_role key, and jobs.url (must be https).`
            );
          } else {
            console.log(`[SEQUENCER] Idle — no pending jobs (gatekeeper will enqueue on its schedule).`);
          }
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        continue;
      }
      idlePolls = 0;
      job = claimed;

      const jobUrl = typeof job.url === 'string' ? job.url.trim() : '';
      if (!/^https?:\/\//i.test(jobUrl)) {
        console.warn('[SEQUENCER] Invalid or missing job.url; marking failed. Row keys:', job?.id ? Object.keys(job) : job);
        if (job.id) {
          await supabase
            .from('jobs')
            .update({
              status: 'failed',
              error_log: 'Invalid or missing job.url (check jobs row and dequeue_next_job RPC shape).'
            })
            .eq('id', job.id);
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        continue;
      }

      const jobIntent = String(job.intent ?? 'ingest').toLowerCase().trim() || 'ingest';
      console.log(
        `\n[SEQUENCER] Processing Job: ${jobUrl}${jobIntent !== 'ingest' ? ` [intent=${jobIntent}]` : ''}`
      );

      // 2. EXTRACT
      const extracted = await extractArticleData(jobUrl);
      console.log(`[SEQUENCER] Extracted: ${extracted.length} characters.`);

      if (extracted.length < config.limits.minChars || extracted.length > config.limits.maxChars) {
        console.log(`[SEQUENCER] Skip logic activated. Length out of bounds.`);
        await supabase.from('jobs').update({ status: 'skipped_length' }).eq('id', job.id);
        continue;
      }

      const clippedSource = clipSourceForRewriter(extracted.textContent);

      // ——— Refresh: re-rewrite existing published row (short-rewrite audit); skip semantic dedup ———
      if (jobIntent === 'refresh') {
        const urlKeys = [...new Set([jobUrl, normalizeArticleUrl(jobUrl)].filter(Boolean))];
        const { data: matchRows } = await supabase
          .from('articles')
          .select('id, slug')
          .in('source_url', urlKeys)
          .eq('status', 'published')
          .limit(1);
        const art = matchRows?.[0];

        if (!art?.id) {
          await supabase
            .from('jobs')
            .update({
              status: 'failed',
              error_log: 'refresh: no published article for this source_url'
            })
            .eq('id', job.id);
          continue;
        }

        const embedding = await generateEmbedding(
          extracted.title + '\n\n' + extracted.textContent.slice(0, 500)
        );

        console.log(`[SEQUENCER] Calling OpenRouter rewrite (refresh)…`);
        const rewritten = await rewriteArticle(extracted.title, extracted.textContent);

        console.log(
          `[SEQUENCER] Generating Cover (${rewritten.cover_type}: ${rewritten.cover_keyword})…`
        );
        const cover = await generateCoverWithFallback(rewritten.cover_type, rewritten.cover_keyword);
        const coverBuffer = cover.buffer;
        const coverTypePublished = cover.cover_fallback ? 'abstract' : rewritten.cover_type;
        const slugKw = cover.cover_fallback ? 'abstract_fallback' : rewritten.cover_keyword;
        const filename = `covers/${Date.now()}-${slugKw.replace(/[^a-z0-9]/gi, '_')}.${cover.extension}`;
        const coverUrl = await uploadToR2(coverBuffer, filename, cover.contentType);
        console.log(`[SEQUENCER] Uploaded Cover: ${coverUrl}`);

        const { error: updErr } = await supabase
          .from('articles')
          .update({
            title: rewritten.title,
            content_md: rewritten.content_md,
            tags: rewritten.tags,
            dek: rewritten.dek,
            primary_rubric: rewritten.primary_rubric,
            cover_url: coverUrl,
            cover_type: coverTypePublished,
            embedding: `[${embedding.join(',')}]`,
            faq: rewritten.faq || [],
            entities: rewritten.entities || [],
            sentiment: rewritten.sentiment || 5,
            source_extract: clippedSource
          })
          .eq('id', art.id);

        if (updErr) {
          throw new Error(`Publisher Update Error: ${updErr.message}`);
        }

        await supabase.from('jobs').update({ status: 'completed' }).eq('id', job.id);
        console.log(
          `[SEQUENCER] Refreshed article /news/${art.slug} (short-rewrite audit). Job done: ${job.url}`
        );

        const articleUrl = `${config.publicSiteUrl}/news/${art.slug}`;
        const idx = await notifyGoogleUrlUpdated(articleUrl);
        if (idx.ok) {
          console.log(`[SEQUENCER] Google Indexing API: URL_UPDATED ${articleUrl}`);
        } else if (isGoogleIndexingConfigured()) {
          console.warn(`[SEQUENCER] Google Indexing API failed:`, idx.error);
        }

        continue;
      }

      // 3. EMBED & DEDUPLICATE (ingest)
      const embedding = await generateEmbedding(extracted.title + '\n\n' + extracted.textContent.slice(0, 500));
      const dedup = await checkDuplicate(embedding);

      if (dedup === 'rpc_error') {
        console.log(`[SEQUENCER] Dedup RPC failed — failing job (fail-closed).`);
        await supabase.from('jobs').update({
          status: 'failed',
          error_log: 'match_articles RPC failed; dedup could not run.'
        }).eq('id', job.id);
        continue;
      }

      if (dedup === 'duplicate') {
        console.log(`[SEQUENCER] Skip logic activated. Semantic duplicate detected.`);
        await supabase.from('jobs').update({ status: 'skipped_duplicate' }).eq('id', job.id);
        continue;
      }

      // 4. REWRITE (OPENROUTER)
      console.log(`[SEQUENCER] Calling OpenRouter rewrite...`);
      const rewritten = await rewriteArticle(extracted.title, extracted.textContent);

      // 5. MEDIA PIPELINE
      console.log(`[SEQUENCER] Generating Cover (${rewritten.cover_type}: ${rewritten.cover_keyword})...`);
      const cover = await generateCoverWithFallback(rewritten.cover_type, rewritten.cover_keyword);
      const coverBuffer = cover.buffer;
      /** Logo failed but FLUX ran — must not keep `company` or the site uses logo letterboxing on a photo. */
      const coverTypePublished = cover.cover_fallback ? 'abstract' : rewritten.cover_type;

      const slugKw = cover.cover_fallback ? 'abstract_fallback' : rewritten.cover_keyword;
      const filename = `covers/${Date.now()}-${slugKw.replace(/[^a-z0-9]/gi, '_')}.${cover.extension}`;
      const coverUrl = await uploadToR2(coverBuffer, filename, cover.contentType);
      console.log(`[SEQUENCER] Uploaded Cover: ${coverUrl}`);

      // 6. PUBLISHER (Save Article)
      console.log(`[SEQUENCER] Publishing Article...`);
      let articleId;
      let publishedSlug;
      try {
        const inserted = await insertPublishedArticleRow(supabase, {
          source_url: job.url,
          title: rewritten.title,
          content_md: rewritten.content_md,
          tags: rewritten.tags,
          dek: rewritten.dek,
          primary_rubric: rewritten.primary_rubric,
          cover_url: coverUrl,
          cover_type: coverTypePublished,
          embedding: `[${embedding.join(',')}]`,
          faq: rewritten.faq || [],
          entities: rewritten.entities || [],
          sentiment: rewritten.sentiment || 5,
          status: 'published',
          slug: rewritten.slug,
          source_extract: clippedSource
        });
        articleId = inserted.id;
        publishedSlug = inserted.slug;
      } catch (insErr) {
        throw new Error(`Publisher Insert Error: ${insErr.message}`);
      }

      // Mark Job as Done
      await supabase.from('jobs').update({ status: 'completed' }).eq('id', job.id);
      console.log(`[SEQUENCER] Job Completed Successfully: ${job.url}`);

      // 7. PUBLISH TO SOCIALS & INDEXING (canonical /news/[slug] matches frontend)
      const articleUrl = `${config.publicSiteUrl}/news/${publishedSlug}`;
      const message = `🚀 *New story*\n\n*${rewritten.title}*\n\n[Read on the site](${articleUrl})`;

      if (process.env.TG_BOT_TOKEN) {
        const token = process.env.TG_BOT_TOKEN;
        if (process.env.TG_ADMIN_CHAT_ID) {
          await sendTelegramMessage(token, process.env.TG_ADMIN_CHAT_ID, message, { parseMode: 'Markdown' });
        }
        if (process.env.TG_CHANNEL_ID) {
          await sendTelegramMessage(token, process.env.TG_CHANNEL_ID, message, { parseMode: 'Markdown' });
        }
      }

      const idx = await notifyGoogleUrlUpdated(articleUrl);
      if (idx.ok) {
        console.log(`[SEQUENCER] Google Indexing API: URL_UPDATED ${articleUrl}`);
      } else if (isGoogleIndexingConfigured()) {
        console.warn(`[SEQUENCER] Google Indexing API failed:`, idx.error);
      }

    } catch (err) {
      console.error(`[SEQUENCER] Job Pipeline Error:`, err.message);
      
      // Update the Database with the formal error trace so it's not lost
      if (job?.id) {
        try {
          await supabase
            .from('jobs')
            .update({ 
              status: 'failed', 
              error_log: err.stack || err.message
            })
            .eq('id', job.id);
        } catch (dbErr) {
          console.error(`[SEQUENCER] Fatal: Failed to write error log to DB.`, dbErr.message);
        }
      }

      // Wait a bit on error to prevent hot loops
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

/** Embedded RSS → jobs polling when running `npm run worker` without a separate gatekeeper container. */
function gatekeeperIntervalMs() {
  const v = process.env.GATEKEEPER_INTERVAL_MS;
  if (v === undefined || v === '') return 30 * 60 * 1000;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function startEmbeddedGatekeeper() {
  const ms = gatekeeperIntervalMs();
  if (ms <= 0) {
    console.log('[SEQUENCER] Embedded RSS gatekeeper off (GATEKEEPER_INTERVAL_MS<=0).');
    return;
  }
  console.log(`[SEQUENCER] Embedded RSS gatekeeper every ${Math.round(ms / 60000)} min`);
  const run = () =>
    runGatekeeper().catch((e) => console.error('[GATEKEEPER] embedded:', e.message));
  setTimeout(run, 10_000);
  setInterval(run, ms);
}

// Execute worker if called directly
if (process.argv[1] && process.argv[1].endsWith('sequencer.js')) {
  startEmbeddedGatekeeper();
  startDailyStatsScheduler();
  spinTelegramAdminWithWorker();
  processQueue();
}
