import { normalizeArticleUrl } from '../lib/article-url.js';
import {
  isRewriteTooShortVsSource,
  rewriteLengthMinRatio,
  rewriteLengthMinSourceChars,
  rewriteRefreshMaxPerCycle
} from '../lib/rewrite-length-quality.js';

/** @param {import('@supabase/supabase-js').SupabaseClient} supabase */
async function fetchQueuedUrlSet(supabase) {
  const queued = new Set();
  const { data, error } = await supabase
    .from('jobs')
    .select('url')
    .in('status', ['pending', 'processing']);
  if (error) {
    console.warn('[short-rewrite-refresh] jobs queue URL fetch failed:', error.message);
    return queued;
  }
  for (const row of data || []) {
    const u = normalizeArticleUrl(row?.url || '');
    if (u) queued.add(u);
  }
  return queued;
}

/**
 * Re-queue published articles whose content_md is &lt; ratio × source_extract length.
 * Reuses existing jobs row (url UNIQUE) or inserts one with intent=refresh.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ skippedDueToBacklog?: boolean }} stats
 * @returns {Promise<{ scanned: number; enqueued: number; skippedQueued: number }>}
 */
export async function enqueueShortRewriteRefreshJobs(supabase, stats = {}) {
  const out = { scanned: 0, enqueued: 0, skippedQueued: 0 };
  if (stats.skippedDueToBacklog) return out;

  const maxPer = rewriteRefreshMaxPerCycle();
  if (maxPer <= 0) return out;

  const ratio = rewriteLengthMinRatio();
  const minSource = rewriteLengthMinSourceChars();
  const queuedUrls = await fetchQueuedUrlSet(supabase);

  const { data: rows, error } = await supabase
    .from('articles')
    .select('id, source_url, source_extract, content_md')
    .eq('status', 'published')
    .not('source_extract', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.warn('[GATEKEEPER] short-rewrite scan failed:', error.message);
    return out;
  }

  for (const row of rows || []) {
    if (out.enqueued >= maxPer) break;
    out.scanned++;
    const src = typeof row.source_extract === 'string' ? row.source_extract : '';
    const md = typeof row.content_md === 'string' ? row.content_md : '';
    if (!isRewriteTooShortVsSource(src, md, { ratio, minSourceChars: minSource })) continue;

    const url = normalizeArticleUrl(row.source_url || '');
    if (!url) continue;
    if (queuedUrls.has(url)) {
      out.skippedQueued++;
      continue;
    }

    const { data: jobRow, error: jobErr } = await supabase
      .from('jobs')
      .select('id, status')
      .eq('url', url)
      .maybeSingle();

    if (jobErr) {
      console.warn('[GATEKEEPER] short-rewrite job lookup failed:', jobErr.message);
      continue;
    }

    if (jobRow && (jobRow.status === 'pending' || jobRow.status === 'processing')) {
      out.skippedQueued++;
      continue;
    }

    if (jobRow) {
      const { error: upErr } = await supabase
        .from('jobs')
        .update({
          status: 'pending',
          intent: 'refresh',
          error_log: null,
          attempts: 0,
          source_name: 'short-rewrite-audit'
        })
        .eq('id', jobRow.id);
      if (upErr) {
        console.warn('[GATEKEEPER] short-rewrite job requeue failed:', upErr.message);
        continue;
      }
    } else {
      const { error: insErr } = await supabase.from('jobs').insert({
        url,
        source_name: 'short-rewrite-audit',
        status: 'pending',
        intent: 'refresh'
      });
      if (insErr) {
        if (insErr.code === '23505') out.skippedQueued++;
        else console.warn('[GATEKEEPER] short-rewrite job insert failed:', insErr.message);
        continue;
      }
    }

    queuedUrls.add(url);
    out.enqueued++;
    console.log(`[GATEKEEPER] Short-rewrite requeue (ratio<${ratio}): ${url}`);
  }

  return out;
}
