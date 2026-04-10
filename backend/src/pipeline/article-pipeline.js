import fs from 'node:fs/promises';
import path from 'node:path';
import { supabase, config } from '../config.js';
import { extractArticleData } from '../scraper/extractor.js';
import { generateEmbedding } from '../brain/embeddings.js';
import { rewriteArticle } from '../brain/rewriter.js';
import { generateCoverWithFallback, FALLBACK_ABSTRACT_COVER_KEYWORD } from '../media/generator.js';
import { uploadToR2 } from '../media/uploader.js';
import { insertPublishedArticleRow } from '../lib/slug.js';
import { clipSourceForRewriter } from '../lib/rewrite-length-quality.js';
import { notifyGoogleUrlUpdated, isGoogleIndexingConfigured } from '../lib/google-indexing.js';

function coverSavePath(requestedPath, extension) {
  const resolved = path.resolve(requestedPath);
  const dir = path.dirname(resolved);
  const base = path.basename(resolved, path.extname(resolved));
  return path.join(dir, `${base}.${extension}`);
}

/** @returns {Promise<'ok'|'duplicate'|'rpc_error'>} */
async function checkDuplicate(embedding) {
  try {
    const { data, error } = await supabase.rpc('match_articles', {
      query_embedding: `[${embedding.join(',')}]`,
      match_threshold: config.limits.similarityThreshold,
      match_count: 1
    });

    if (error) {
      console.warn('[PIPELINE] match_articles RPC failed:', error.message);
      return 'rpc_error';
    }
    if (data && data.length > 0) return 'duplicate';
    return 'ok';
  } catch (e) {
    console.warn('[PIPELINE] match_articles exception:', e.message);
    return 'rpc_error';
  }
}

/**
 * Full article generation: extract → embed → dedup → rewrite → cover → (upload) → (insert).
 * @param {string} url
 * @param {{ dryRun?: boolean, skipDedup?: boolean, skipPublish?: boolean, localOnly?: boolean, saveCoverTo?: string, embedCoverBase64?: boolean }} [opts]
 *
 * `localOnly`: extract + rewrite + cover only (no Supabase/R2). For quality checks without DB.
 */
export async function runArticlePipeline(url, opts = {}) {
  const localOnly = Boolean(opts.localOnly);
  const dryRun = Boolean(opts.dryRun) || localOnly;
  const skipDedup = Boolean(opts.skipDedup) || localOnly;
  const skipPublish = Boolean(opts.skipPublish) || dryRun;

  const result = {
    ok: false,
    url,
    localOnly,
    steps: [],
    error: null,
    extracted: null,
    rewritten: null,
    coverBytes: null,
    coverMime: null,
    coverExtension: null,
    coverUrl: null,
    cover_base64: null,
    cover_saved_to: null,
    articleId: null,
    public_url: null,
    dedup: null
  };

  try {
    const extracted = await extractArticleData(url);
    result.extracted = {
      title: extracted.title,
      length: extracted.length,
      excerpt: (extracted.excerpt || '').slice(0, 280)
    };
    result.steps.push('extract');

    if (extracted.length < config.limits.minChars || extracted.length > config.limits.maxChars) {
      result.error = `length_out_of_bounds:${extracted.length}`;
      return result;
    }

    let embedding = null;
    if (!localOnly) {
      embedding = await generateEmbedding(
        extracted.title + '\n\n' + extracted.textContent.slice(0, 500)
      );
      result.steps.push('embed');
    }

    if (!skipDedup && embedding) {
      const dedup = await checkDuplicate(embedding);
      result.dedup = dedup;
      result.steps.push(`dedup:${dedup}`);
      if (dedup === 'rpc_error') {
        result.error = 'dedup_rpc_failed';
        return result;
      }
      if (dedup === 'duplicate') {
        result.error = 'duplicate';
        return result;
      }
    }

    const clippedSource = clipSourceForRewriter(extracted.textContent);
    const rewritten = await rewriteArticle(extracted.title, extracted.textContent);
    result.rewritten = {
      title: rewritten.title,
      slug: rewritten.slug,
      content_preview: rewritten.content_md.slice(0, 600),
      tags: rewritten.tags,
      cover_type: rewritten.cover_type,
      cover_keyword: rewritten.cover_keyword,
      sentiment: rewritten.sentiment,
      faq_count: rewritten.faq?.length ?? 0,
      entities_count: rewritten.entities?.length ?? 0
    };
    result.steps.push('rewrite');

    const cover = await generateCoverWithFallback(rewritten.cover_type, rewritten.cover_keyword);
    const coverTypePublished = cover.cover_fallback ? 'abstract' : rewritten.cover_type;
    if (cover.cover_fallback) {
      result.rewritten.cover_fallback = true;
      result.rewritten.cover_keyword_used = FALLBACK_ABSTRACT_COVER_KEYWORD;
    }

    const coverBuffer = cover.buffer;
    result.coverBytes = coverBuffer.length;
    result.coverMime = cover.contentType;
    result.coverExtension = cover.extension;
    result.steps.push('cover');

    if (opts.saveCoverTo) {
      const abs = coverSavePath(opts.saveCoverTo, cover.extension);
      await fs.writeFile(abs, coverBuffer);
      result.cover_saved_to = abs;
      result.steps.push('cover_saved');
    }

    if (localOnly || dryRun) {
      if (opts.embedCoverBase64) {
        result.cover_base64 = Buffer.from(coverBuffer).toString('base64');
      }
      result.ok = true;
      result.steps.push(localOnly ? 'local_only_done' : 'dry_run_stop');
      return result;
    }

    const ext = cover.extension;
    const filename = `covers/${Date.now()}-${rewritten.cover_keyword.replace(/[^a-z0-9]/gi, '_').slice(0, 40)}.${ext}`;
    const coverUrl = await uploadToR2(coverBuffer, filename, cover.contentType);
    result.coverUrl = coverUrl;
    result.steps.push('r2');

    if (skipPublish || !embedding) {
      result.ok = true;
      result.steps.push('skip_publish');
      return result;
    }

    let inserted;
    try {
      inserted = await insertPublishedArticleRow(supabase, {
        source_url: url,
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
    } catch (insertErr) {
      result.error = `insert:${insertErr.message}`;
      return result;
    }

    result.articleId = inserted?.id ?? null;
    if (inserted?.slug) result.public_url = `${config.publicSiteUrl}/news/${inserted.slug}`;
    result.steps.push('publish');

    if (result.public_url && isGoogleIndexingConfigured()) {
      const idx = await notifyGoogleUrlUpdated(result.public_url);
      if (idx.ok) result.steps.push('google_indexing');
      else {
        result.steps.push(`google_indexing_failed:${(idx.error || 'unknown').slice(0, 120)}`);
        console.warn('[PIPELINE] Google Indexing API:', idx.error);
      }
    }

    result.ok = true;
    return result;
  } catch (err) {
    result.error = err.message || String(err);
    return result;
  }
}
