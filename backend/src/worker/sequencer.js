import fetch from 'node-fetch';
import { supabase, config } from '../config.js';
import { extractArticleData } from '../scraper/extractor.js';
import { generateEmbedding } from '../brain/embeddings.js';
import { rewriteArticle } from '../brain/rewriter.js';
import { generateCover } from '../media/generator.js';
import { uploadToR2 } from '../media/uploader.js';

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

export async function processQueue() {
  console.log('[SEQUENCER] Worker started. Waiting for jobs...');

  while (true) {
    let job = null;
    try {
      // 1. ATOMIC JOB ACQUISITION (Simulated via Update with limit)
      // Lock a pending job
      const { data: jobs, error: fetchError } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1);

      if (fetchError || !jobs || jobs.length === 0) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        continue; // Back to polling
      }

      job = jobs[0];
      
      // Mark as processing
      await supabase
        .from('jobs')
        .update({ status: 'processing', attempts: job.attempts + 1 })
        .eq('id', job.id);

      console.log(`\n[SEQUENCER] Processing Job: ${job.url}`);

      // 2. EXTRACT
      const extracted = await extractArticleData(job.url);
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
      const coverBuffer = await generateCover(rewritten.cover_type, rewritten.cover_keyword);
      
      const filename = `covers/${Date.now()}-${rewritten.cover_keyword.replace(/[^a-z0-9]/gi, '_')}.webp`;
      const coverUrl = await uploadToR2(coverBuffer, filename, 'image/webp');
      console.log(`[SEQUENCER] Uploaded Cover: ${coverUrl}`);

      // 6. PUBLISHER (Save Article)
      console.log(`[SEQUENCER] Publishing Article...`);
      const { data: insertData, error: insertError } = await supabase.from('articles').insert({
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
        status: 'published'
      }).select('id');

      if (insertError) throw new Error(`Publisher Insert Error: ${insertError.message}`);

      // Mark Job as Done
      await supabase.from('jobs').update({ status: 'completed' }).eq('id', job.id);
      console.log(`[SEQUENCER] Job Completed Successfully: ${job.url}`);

      // 7. PUBLISH TO SOCIALS & INDEXING
      const articleUrl = `https://siliconfeed.online/article/${insertData[0]?.id || job.id}`;
      const message = `🚀 *Новая статья!*\n\n*${rewritten.title}*\n\n[Читать на сайте](${articleUrl})`;

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
          const jwtClient = new google.auth.JWT(
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            null,
            process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            ['https://www.googleapis.com/auth/indexing'],
            null
          );
          
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
