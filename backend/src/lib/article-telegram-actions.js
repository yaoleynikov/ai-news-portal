import { extractArticleData } from '../scraper/extractor.js';
import { rewriteArticle } from '../brain/rewriter.js';
import {
  generateCoverWithFallback,
  FALLBACK_ABSTRACT_COVER_KEYWORD
} from '../media/generator.js';
import { uploadToR2 } from '../media/uploader.js';
import { generateEmbedding } from '../brain/embeddings.js';
import { config } from '../config.js';
import { buildFluxPromptFromEditorNote } from './flux-prompt-from-note.js';
import { notifyGoogleUrlDeleted, notifyGoogleUrlUpdated } from './google-indexing.js';
import { clipSourceForRewriter } from './rewrite-length-quality.js';
import { normalizeUserLogoDomain, guessLogoDomainFromRow } from './logo-domain.js';

export { normalizeUserLogoDomain, guessLogoDomainFromRow } from './logo-domain.js';

function stripHostOrigin(url) {
  return String(url || '')
    .trim()
    .replace(/\/$/, '');
}

/** @param {string} siteUrl PUBLIC_SITE_URL */
export function siteOriginsForSlug(siteUrl) {
  const base = stripHostOrigin(siteUrl || config.publicSiteUrl);
  const out = new Set([base]);
  try {
    const u = new URL(base);
    if (u.hostname.startsWith('www.')) {
      out.add(`${u.protocol}//${u.hostname.slice(4)}`);
    } else {
      out.add(`${u.protocol}//www.${u.hostname}`);
    }
  } catch {
    /* ignore */
  }
  return [...out];
}

/**
 * @param {string} text
 * @param {string[]} origins
 * @returns {string | null}
 */
export function extractSiliconfeedSlugFromText(text, origins) {
  const t = String(text || '');
  for (const o of origins) {
    const esc = o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`${esc}/news/([^/?#\\s]+)`, 'i');
    const m = re.exec(t);
    if (!m) continue;
    const raw = m[1].replace(/\/$/, '').trim();
    if (
      /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/i.test(raw) ||
      /^[a-z0-9]{3,80}$/i.test(raw)
    ) {
      return raw.toLowerCase();
    }
  }
  return null;
}

function extractFirstHttpUrl(text) {
  const m = String(text || '').match(/https?:\/\/[^\s<>"')]+/i);
  return m ? m[0].replace(/[),.;]+$/, '') : null;
}

/** All http(s) URLs in text (for multi-link messages). */
function extractAllHttpUrls(text) {
  const s = String(text || '');
  const re = /https?:\/\/[^\s<>"')]+/gi;
  const out = [];
  let m;
  while ((m = re.exec(s)) !== null) {
    out.push(m[0].replace(/[),.;]+$/, ''));
  }
  return out;
}

/** Strip BOM / zero-width / unicode marks that break URL regex. */
function normalizeUserPaste(text) {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

/**
 * /news/slug on any host (preview, alternate domain).
 * @param {string} text
 * @returns {string | null} slug
 */
export function extractNewsSlugAnyHost(text) {
  const m = String(text || '').match(/https?:\/\/[^/]+\/news\/([^/?#\s]+)/i);
  if (!m) return null;
  const raw = m[1].replace(/\/$/, '').trim().toLowerCase();
  if (
    /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/.test(raw) ||
    /^[a-z0-9]{3,80}$/.test(raw)
  ) {
    return raw;
  }
  return null;
}

function normalizeArticleUrl(u) {
  try {
    const x = new URL(u);
    x.hash = '';
    let s = x.href;
    if (s.endsWith('/') && x.pathname !== '/') s = s.slice(0, -1);
    return s;
  } catch {
    return String(u || '').trim();
  }
}

/**
 * Bare slug line: only slug characters.
 * @param {string} text
 */
export function maybeBareSlug(text) {
  const s = String(text || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/.test(s) && !/^[a-z0-9]{3,80}$/.test(s)) return null;
  if (s.includes(' ') || s.includes('/') || s.includes('.')) return null;
  return s.toLowerCase();
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} text user message
 */
async function findBySlug(supabase, slug) {
  const s = String(slug || '').toLowerCase();
  if (!s) return null;
  const { data, error } = await supabase.from('articles').select('*').eq('slug', s).maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

export async function findArticleFromUserText(supabase, text) {
  const raw = normalizeUserPaste(text);
  const origins = siteOriginsForSlug(config.publicSiteUrl);

  const slugFromConfiguredHosts = extractSiliconfeedSlugFromText(raw, origins);
  if (slugFromConfiguredHosts) {
    const row = await findBySlug(supabase, slugFromConfiguredHosts);
    if (row) return row;
  }

  const slugAnyHost = extractNewsSlugAnyHost(raw);
  if (slugAnyHost) {
    const row = await findBySlug(supabase, slugAnyHost);
    if (row) return row;
  }

  const bare = maybeBareSlug(raw);
  if (bare) {
    const row = await findBySlug(supabase, bare);
    if (row) return row;
  }

  const urls = extractAllHttpUrls(raw);
  const toTry = urls.length ? urls : extractFirstHttpUrl(raw) ? [extractFirstHttpUrl(raw)] : [];
  for (const url of toTry) {
    if (!url) continue;
    const norm = normalizeArticleUrl(url);
    const variants = [norm, norm + '/', norm.replace(/\/$/, '')];
    const uniq = [...new Set(variants)];
    for (const v of uniq) {
      const { data, error } = await supabase.from('articles').select('*').eq('source_url', v).maybeSingle();
      if (error) throw new Error(error.message);
      if (data) return data;
    }
    const { data: rows, error: e2 } = await supabase.from('articles').select('*').ilike('source_url', `${norm}%`);
    if (e2) throw new Error(e2.message);
    if (rows?.length === 1) return rows[0];
  }

  return null;
}

function stripMdRough(md) {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*?|__/g, '')
    .replace(/`+/g, '')
    .replace(/\[(.*?)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Re-scrape source_url when possible; keep existing slug.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Record<string, unknown>} row articles row
 * @param {{ onProgress?: (line: string) => void | Promise<void> }} [options]
 */
export async function rewriteArticleRow(supabase, row, options = {}) {
  const onProgress =
    typeof options.onProgress === 'function' ? options.onProgress : async () => {};

  const id = String(row.id);
  const slug = typeof row.slug === 'string' ? row.slug : '';
  const sourceUrl = typeof row.source_url === 'string' ? row.source_url : '';

  console.log('[article-telegram-actions] Рерайт slug=', slug, 'id=', id);
  await onProgress(`⏳ Рерайт: старт\nslug: ${slug || id}`);

  let title = typeof row.title === 'string' ? row.title : '';
  let body = stripMdRough(row.content_md);
  let source = 'stored_md';

  if (sourceUrl) {
    try {
      await onProgress('⏳ Скачиваю оригинал по source_url…');
      console.log('[article-telegram-actions] Скачиваю оригинал:', sourceUrl);
      const ex = await extractArticleData(sourceUrl);
      title = ex.title || title;
      body = ex.textContent || body;
      source = 'rescrape';
      await onProgress(`⏳ Оригинал скачан (${body.length} симв.), готовлю рерайт…`);
      console.log(
        '[article-telegram-actions] Оригинал:',
        body.length,
        'симв., заголовок:',
        String(title).slice(0, 80)
      );
    } catch (e) {
      console.warn('[article-telegram-actions] Скрейп не удался, беру текст из БД:', e.message);
      await onProgress(`⏳ Скрейп не вышел — беру текст из БД (~${body.length} симв.)`);
      source = 'stored_md_fallback';
    }
  } else {
    await onProgress(`⏳ Нет source_url — рерайт по сохранённому тексту (~${body.length} симв.)`);
    console.log('[article-telegram-actions] Нет source_url, рерайт по сохранённому markdown (~', body.length, 'симв.)');
  }

  await onProgress('⏳ OpenRouter: рерайт (обычно 30 с — 2 мин)…');
  console.log('[article-telegram-actions] OpenRouter rewrite…', { source });
  const sourceForClip = typeof body === 'string' ? body : '';
  const rewritten = await rewriteArticle(title, body);
  await onProgress(`⏳ Ответ модели: ${rewritten.content_md.length} симв. Считаю embedding…`);
  console.log(
    '[article-telegram-actions] Модель вернула:',
    rewritten.content_md.length,
    'симв. в content_md'
  );

  console.log('[article-telegram-actions] Embedding…');
  const emb = await generateEmbedding(
    `${rewritten.title}\n\n${rewritten.content_md.slice(0, 500)}`
  );

  await onProgress('⏳ Сохраняю в Supabase…');

  const { error } = await supabase
    .from('articles')
    .update({
      title: rewritten.title,
      content_md: rewritten.content_md,
      tags: rewritten.tags,
      dek: rewritten.dek,
      primary_rubric: rewritten.primary_rubric,
      faq: rewritten.faq,
      entities: rewritten.entities,
      sentiment: rewritten.sentiment,
      cover_type: rewritten.cover_type,
      embedding: `[${emb.join(',')}]`,
      source_extract: clipSourceForRewriter(sourceForClip)
    })
    .eq('id', id);

  if (error) throw new Error(error.message);

  console.log('[article-telegram-actions] Рерайт сохранён в БД slug=', slug);

  if (slug) {
    const articleUrl = `${stripHostOrigin(config.publicSiteUrl)}/news/${slug}`;
    notifyGoogleUrlUpdated(articleUrl).catch(() => {});
  }

  return { title: rewritten.title, slug };
}

/**
 * Abstract cover from editor note (Cloudflare FLUX.2 Klein when configured, else Horde/HF); sets cover_type abstract.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Record<string, unknown>} row
 * @param {string} editorNote
 * @param {{ onProgress?: (line: string) => void | Promise<void> }} [options]
 */
export async function regenerateArticleCoverFromNote(supabase, row, editorNote, options = {}) {
  const onProgress =
    typeof options.onProgress === 'function' ? options.onProgress : async () => {};

  const id = String(row.id);
  const slug = typeof row.slug === 'string' ? row.slug : 'article';

  console.log('[article-telegram-actions] Обложка slug=', slug, 'заметка:', String(editorNote || '').slice(0, 100));
  await onProgress(`⏳ Обложка: сбор промпта\nslug: ${slug}`);

  const prompt = await buildFluxPromptFromEditorNote({
    title: String(row.title || ''),
    contentPreview: String(row.content_md || ''),
    editorNote
  });
  await onProgress(
    `⏳ Промпт готов (${prompt.length} симв.), генерация обложки (Workers AI Klein / резерв Horde·HF)…\n— ${prompt.slice(0, 220)}${prompt.length > 220 ? '…' : ''}`
  );
  console.log('[article-telegram-actions] Промпт обложки:', prompt.slice(0, 160));

  console.log('[article-telegram-actions] Генерация изображения (generateCover abstract)…');
  const cover = await generateCoverWithFallback('abstract', prompt, {
    skipCoverSceneExpand: true,
    title: String(row.title || ''),
    content_md: String(row.content_md || '')
  });
  await onProgress('⏳ Изображение готово, загрузка в R2…');
  const safe = slug.replace(/[^a-z0-9-_]/gi, '_').slice(0, 48);
  const filename = `covers/${Date.now()}-tg-${safe}.${cover.extension}`;
  const coverUrl = await uploadToR2(cover.buffer, filename, cover.contentType);

  await onProgress('⏳ Обновляю cover_url в базе…');

  const { error } = await supabase
    .from('articles')
    .update({
      cover_url: coverUrl,
      cover_type: 'abstract'
    })
    .eq('id', id);

  if (error) throw new Error(error.message);

  console.log('[article-telegram-actions] Обложка загружена:', coverUrl?.slice(0, 100));

  if (slug) {
    const articleUrl = `${stripHostOrigin(config.publicSiteUrl)}/news/${slug}`;
    notifyGoogleUrlUpdated(articleUrl).catch(() => {});
  }

  return { cover_url: coverUrl, prompt_used: prompt };
}

function abstractKeywordForToggleFromRow(row) {
  const title = String(row.title || '').trim();
  const body = stripMdRough(row.content_md || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 320);
  const s = body ? `${title}. ${body}` : title;
  const out = s.slice(0, 480);
  return out.length >= 35 ? out : FALLBACK_ABSTRACT_COVER_KEYWORD;
}

/**
 * Обложка company (Logo.dev) + загрузка в R2. Домен из `logoDomain` или автоугадать из строки.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Record<string, unknown>} row
 * @param {{ onProgress?: (line: string) => void | Promise<void>; logoDomain?: string }} [options]
 */
export async function regenerateArticleCompanyLogo(supabase, row, options = {}) {
  const onProgress =
    typeof options.onProgress === 'function' ? options.onProgress : async () => {};

  const id = String(row.id);
  const slug = typeof row.slug === 'string' ? row.slug : 'article';

  const rawManual = typeof options.logoDomain === 'string' ? options.logoDomain.trim() : '';
  const manual = rawManual ? normalizeUserLogoDomain(options.logoDomain) : null;
  if (rawManual && !manual) {
    throw new Error('Некорректный домен для Logo.dev. Пример: company.com или https://company.com');
  }
  const domain = manual ?? guessLogoDomainFromRow(row);
  if (!domain) {
    throw new Error(
      'Нет домена для Logo.dev: в cover_keyword нет валидного apex-домена (рерайтер для company должен записать его туда). Укажи домен вручную в Telegram или сделай рерайт.'
    );
  }
  await onProgress(`⏳ Logo.dev: ${domain}…`);
  const cover = await generateCoverWithFallback('company', domain, {
    title: String(row.title || ''),
    content_md: String(row.content_md || '')
  });
  const coverTypePublished = cover.cover_fallback ? 'abstract' : 'company';
  await onProgress('⏳ Загрузка в R2…');
  const safe = slug.replace(/[^a-z0-9-_]/gi, '_').slice(0, 48);
  const filename = `covers/${Date.now()}-tg-logo-${safe}.${cover.extension}`;
  const coverUrl = await uploadToR2(cover.buffer, filename, cover.contentType);
  await onProgress('⏳ Обновляю базу…');
  const { error } = await supabase
    .from('articles')
    .update({ cover_url: coverUrl, cover_type: coverTypePublished })
    .eq('id', id);
  if (error) throw new Error(error.message);
  if (slug) {
    const articleUrl = `${stripHostOrigin(config.publicSiteUrl)}/news/${slug}`;
    notifyGoogleUrlUpdated(articleUrl).catch(() => {});
  }
  return {
    cover_url: coverUrl,
    cover_type: coverTypePublished,
    direction: 'to_company',
    domain_used: domain,
    used_fallback_image: Boolean(cover.cover_fallback)
  };
}

/**
 * Flip cover_type + regenerate: company (Logo.dev) ↔ abstract (Klein / Horde / HF from article text).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Record<string, unknown>} row
 * @param {{ onProgress?: (line: string) => void | Promise<void>; logoDomain?: string }} [options]
 *   `logoDomain` — явный hostname для Logo.dev, если автоугадать не удалось (Telegram).
 */
export async function toggleArticleCoverType(supabase, row, options = {}) {
  const onProgress =
    typeof options.onProgress === 'function' ? options.onProgress : async () => {};

  const id = String(row.id);
  const slug = typeof row.slug === 'string' ? row.slug : 'article';
  const currentIsCompany = row.cover_type === 'company';

  if (currentIsCompany) {
    await onProgress('⏳ Было лого → генерирую фото по тексту статьи (Klein / резерв)…');
    const keyword = abstractKeywordForToggleFromRow(row);
    const cover = await generateCoverWithFallback('abstract', keyword, {
      title: String(row.title || ''),
      dek: String(row.dek || ''),
      primary_rubric: String(row.primary_rubric || ''),
      tags: Array.isArray(row.tags) ? row.tags : [],
      content_md: String(row.content_md || '')
    });
    const coverTypePublished = 'abstract';
    await onProgress('⏳ Загрузка в R2…');
    const safe = slug.replace(/[^a-z0-9-_]/gi, '_').slice(0, 48);
    const filename = `covers/${Date.now()}-tg-flip-${safe}.${cover.extension}`;
    const coverUrl = await uploadToR2(cover.buffer, filename, cover.contentType);
    await onProgress('⏳ Обновляю базу…');
    const { error } = await supabase
      .from('articles')
      .update({ cover_url: coverUrl, cover_type: coverTypePublished })
      .eq('id', id);
    if (error) throw new Error(error.message);
    if (slug) {
      const articleUrl = `${stripHostOrigin(config.publicSiteUrl)}/news/${slug}`;
      notifyGoogleUrlUpdated(articleUrl).catch(() => {});
    }
    return { cover_url: coverUrl, cover_type: coverTypePublished, direction: 'to_abstract' };
  }

  await onProgress('⏳ Было фото → ищу бренд для лого…');
  return regenerateArticleCompanyLogo(supabase, row, options);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} id uuid
 * @param {{ slug?: string }} [opts] slug для уведомления Google Indexing API (URL_DELETED) до удаления строки
 */
export async function deleteArticleById(supabase, id, opts = {}) {
  console.log('[article-telegram-actions] Удаление статьи id=', id);
  let articleUrl = '';
  const slugFromOpts = typeof opts.slug === 'string' ? opts.slug.trim() : '';
  if (slugFromOpts) {
    articleUrl = `${stripHostOrigin(config.publicSiteUrl)}/news/${slugFromOpts}`;
  } else {
    const { data } = await supabase.from('articles').select('slug').eq('id', id).maybeSingle();
    const s = typeof data?.slug === 'string' ? data.slug.trim() : '';
    if (s) articleUrl = `${stripHostOrigin(config.publicSiteUrl)}/news/${s}`;
  }
  if (articleUrl) {
    void notifyGoogleUrlDeleted(articleUrl).then((r) => {
      if (!r.ok && r.error) {
        console.warn('[article-telegram-actions] Google URL_DELETED:', r.error);
      } else if (r.ok) {
        console.log('[article-telegram-actions] Google URL_DELETED отправлен:', articleUrl);
      }
    });
  }
  const { error } = await supabase.from('articles').delete().eq('id', id);
  if (error) throw new Error(error.message);
  console.log('[article-telegram-actions] Строка articles удалена id=', id);
}
