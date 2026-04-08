import fetch from 'node-fetch';
import { supabase, config } from '../config.js';
import { extractArticleData } from '../scraper/extractor.js';
import { generateEmbedding } from '../brain/embeddings.js';
import { rewriteArticle } from '../brain/rewriter.js';
import { generateCoverWithFallback } from '../media/generator.js';
import { uploadToR2 } from '../media/uploader.js';
import { insertPublishedArticleRow } from '../lib/slug.js';
import { normalizeGooglePrivateKey } from '../lib/pem.js';

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

async function sendTelegramMessage(botToken, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  });
  let body = {};
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok || body.ok === false) {
    console.warn('[SEQUENCER] Telegram sendMessage failed:', res.status, body.description || JSON.stringify(body).slice(0, 200));
  }
}

// Polling interval
const POLL_INTERVAL_MS = 10000;

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

/** Prefer DB RPC `dequeue_next_job` (migration 0005); fall back if RPC missing. */
async function claimNextJob() {
  const { data: fromRpc, error: rpcErr } = await supabase.rpc('dequeue_next_job');

  if (!rpcErr) {
    const row = normalizeJobRow(fromRpc);
    if (row?.id) return { job: row, mode: 'rpc' };
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

  return { job: updated, mode: 'legacy' };
}

export async function processQueue() {
  console.log('[SEQUENCER] Worker started. Waiting for jobs...');

  while (true) {
    let job = null;
    try {
      const { job: claimed } = await claimNextJob();
      if (!claimed) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        continue;
      }
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

      console.log(`\n[SEQUENCER] Processing Job: ${jobUrl}`);

      // 2. EXTRACT
      const extracted = await extractArticleData(jobUrl);
      console.log(`[SEQUENCER] Extracted: ${extracted.length} characters.`);
      
      if (extracted.length < config.limits.minChars || extracted.length > config.limits.maxChars) {
        console.log(`[SEQUENCER] Skip logic activated. Length out of bounds.`);
        await supabase.from('jobs').update({ status: 'skipped_length' }).eq('id', job.id);
        continue;
      }

      // 3. EMBED & DEDUPLICATE
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
          cover_url: coverUrl,
          cover_type: rewritten.cover_type,
          embedding: `[${embedding.join(',')}]`,
          faq: rewritten.faq || [],
          entities: rewritten.entities || [],
          sentiment: rewritten.sentiment || 5,
          status: 'published',
          slug: rewritten.slug
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
          await sendTelegramMessage(token, process.env.TG_ADMIN_CHAT_ID, message);
        }
        if (process.env.TG_CHANNEL_ID) {
          await sendTelegramMessage(token, process.env.TG_CHANNEL_ID, message);
        }
      }

      // 8. GOOGLE INDEXING API PING
      if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
        try {
          // Dynamic import of googleapis to save memory if not used
          const { google } = await import('googleapis');
          const jwtClient = new google.auth.JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: normalizeGooglePrivateKey(process.env.GOOGLE_PRIVATE_KEY),
            scopes: ['https://www.googleapis.com/auth/indexing'],
          });
          
          await jwtClient.authorize();
          const indexing = google.indexing({ version: 'v3', auth: jwtClient });
          
          await indexing.urlNotifications.publish({
            requestBody: {
              url: articleUrl,
              type: 'URL_UPDATED'
            }
          });
          console.log(`[SEQUENCER] SEO: Pushed URL to Google Indexing API`);
        } catch (idxErr) {
          console.warn(`[SEQUENCER] SEO Google Indexing failed:`, idxErr.message);
        }
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

// Execute worker if called directly
if (process.argv[1] && process.argv[1].endsWith('sequencer.js')) {
  processQueue();
}
