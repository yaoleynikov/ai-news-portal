import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ARTICLES, getArticleBySlug as getStaticArticleBySlug, type NewsArticle } from '../data/news';
import type { MockArticle } from '../data/mock-articles';

/**
 * After migration 0011; fallback select when `dek` / `updated_at` are missing.
 * Include `primary_rubric` so /rubric/* matches Topics counts (articleInRubric prefers DB rubric over tags).
 */
const CARD_FIELDS_CORE =
  'id, slug, title, content_md, tags, cover_url, cover_type, created_at, source_url, faq, entities, sentiment, status, primary_rubric';
const CARD_FIELDS = `${CARD_FIELDS_CORE}, dek, updated_at`;

function shouldRetryArticleSelectWithoutNewColumns(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = String(error.message || '').toLowerCase();
  const code = String((error as { code?: string }).code || '');
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    (msg.includes('column') && (msg.includes('does not exist') || msg.includes('unknown'))) ||
    msg.includes('schema cache')
  );
}

/** This project’s public r2.dev base; used only when the cover URL host is siliconfeed.r2.cloudflarestorage.com and env on the host is empty. */
const SILICONFEED_R2_PUBLIC_DEFAULT = 'https://pub-ffc5900a06d64e009bb6babb2d096132.r2.dev';

function r2PublicBaseForUrl(raw: string): string | undefined {
  const fromVite = (import.meta.env.PUBLIC_R2_PUBLIC_URL as string | undefined)?.trim().replace(/\/$/, '');
  if (fromVite) return fromVite;
  const proc = typeof process !== 'undefined' ? process.env : undefined;
  const fromNode =
    proc?.['R2_PUBLIC_URL']?.trim().replace(/\/$/, '') ||
    proc?.['PUBLIC_R2_PUBLIC_URL']?.trim().replace(/\/$/, '');
  if (fromNode) return fromNode;
  if (/siliconfeed\.r2\.cloudflarestorage\.com/i.test(raw)) {
    return SILICONFEED_R2_PUBLIC_DEFAULT.replace(/\/$/, '');
  }
  return undefined;
}

/**
 * Older rows may store the S3 API host (*.r2.cloudflarestorage.com), which is not valid for <img src>.
 * On Vercel set R2_PUBLIC_URL or PUBLIC_R2_PUBLIC_URL (same base URL as backend/.env for the worker).
 */
export function normalizeCoverUrl(url: string): string {
  const raw = typeof url === 'string' ? url.trim() : '';
  if (!raw) return '';
  if (!/r2\.cloudflarestorage\.com/i.test(raw)) return raw;
  const base = r2PublicBaseForUrl(raw);
  if (!base) return raw;
  try {
    const u = new URL(raw);
    return `${base}${u.pathname}${u.search}`;
  } catch {
    return raw;
  }
}

/**
 * Remote cover <img>: do not set crossOrigin (no CORS mode on the image request).
 * Strip Referer so CDNs that hotlink-block by referrer still serve the asset (direct URL in a tab sends no site referrer).
 */
export const coverImageRequestAttrs = { referrerpolicy: 'no-referrer' } as const;

function r2PublicHostnameFromEnv(): string | null {
  const fromVite = (import.meta.env.PUBLIC_R2_PUBLIC_URL as string | undefined)?.trim().replace(/\/$/, '');
  if (fromVite) {
    try {
      return new URL(fromVite).hostname.toLowerCase();
    } catch {
      /* ignore */
    }
  }
  const proc = typeof process !== 'undefined' ? process.env : undefined;
  const fromNode =
    proc?.['R2_PUBLIC_URL']?.trim().replace(/\/$/, '') ||
    proc?.['PUBLIC_R2_PUBLIC_URL']?.trim().replace(/\/$/, '');
  if (fromNode) {
    try {
      return new URL(fromNode).hostname.toLowerCase();
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Hosts where crossOrigin="anonymous" breaks <img> (no ACAO on image responses). */
function hostBlocksCrossOriginImg(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'cdn.samsung.com' || h.endsWith('.cdn.samsung.com');
}

/**
 * Attributes for <img> inside [data-cover-edge]: Referer stripped + crossOrigin when the host is
 * expected to allow CORS on images so cover-edge-frame.ts can read pixels (otherwise backdrop stays --cover-backdrop).
 * R2 public URLs (*.r2.dev / env host) intentionally omit crossOrigin: CORS mode fails the whole image if ACAO is missing
 * on any response (seen as first-load flake); without crossOrigin the image always paints and tint is best-effort.
 */
export function coverEdgeTintImgAttrs(url: string, siteOrigin?: string): Record<string, string> {
  const raw = normalizeCoverUrl(typeof url === 'string' ? url.trim() : '');
  const out: Record<string, string> = { referrerpolicy: 'no-referrer' };
  if (!raw) return out;
  let hostname: string;
  try {
    hostname = new URL(raw).hostname.toLowerCase();
  } catch {
    return out;
  }

  if (hostBlocksCrossOriginImg(hostname)) return out;

  if (siteOrigin) {
    try {
      if (hostname === new URL(siteOrigin).hostname.toLowerCase()) {
        out.crossorigin = 'anonymous';
        return out;
      }
    } catch {
      /* ignore */
    }
  }

  const r2h = r2PublicHostnameFromEnv();
  if (r2h && hostname === r2h) {
    return out;
  }
  if (hostname.endsWith('.r2.dev')) {
    return out;
  }
  if (hostname === 'img.logo.dev' || hostname.endsWith('.cloudinary.com') || hostname === 'cloudinary.com') {
    out.crossorigin = 'anonymous';
    return out;
  }

  return out;
}

/**
 * SSR / server fetch for cover tint: only these hosts (mitigate SSRF when downloading by URL).
 */
export function isCoverHostAllowedForServerImageFetch(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h.endsWith('.r2.dev')) return true;
  if (h.endsWith('.r2.cloudflarestorage.com')) return true;
  if (h === 'img.logo.dev' || h.endsWith('.cloudinary.com') || h === 'cloudinary.com') return true;
  const r2h = r2PublicHostnameFromEnv();
  if (r2h && h === r2h) return true;
  return false;
}

const MOCK_FALLBACK: MockArticle[] = ARTICLES.map(
  ({ id, slug, title, excerpt, cover_url, cover_type, tags, created_at, primary_rubric }) => ({
    id,
    slug,
    title,
    excerpt,
    cover_url,
    cover_type,
    tags,
    created_at,
    primary_rubric
  })
);

/** Vercel serverless fills process.env; locally use import.meta.env.PUBLIC_* or .env. */
function supabaseUrl(): string | undefined {
  if (typeof process !== 'undefined') {
    const u = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    if (u?.trim()) return u.trim();
  }
  const p = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
  return p?.trim() || undefined;
}

function supabaseKey(): string | undefined {
  if (typeof process !== 'undefined') {
    const k =
      process.env.PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_KEY;
    if (k?.trim()) return k.trim();
  }
  const p = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  return p?.trim() || undefined;
}

function getServerClient(): SupabaseClient | null {
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) return null;
  return createClient(url, key);
}

function excerptFromMarkdown(md: string, max = 220): string {
  const plain = md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max - 1)}…`;
}

/** ~2–3 lines in home river / cards; trim on word boundary when possible. */
export const LISTING_EXCERPT_MAX_CHARS = 220;

export function clipListingExcerpt(text: string, max = LISTING_EXCERPT_MAX_CHARS): string {
  const t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max - 1);
  const cut = slice.lastIndexOf(' ');
  const base = cut > Math.floor(max * 0.45) ? slice.slice(0, cut) : slice;
  return `${base}…`;
}

const STORED_RUBRIC_SLUGS = new Set([
  'ai',
  'hardware',
  'open-source',
  'security',
  'energy',
  'other'
]);

function normalizeStoredPrimaryRubric(v: unknown): string | undefined {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return STORED_RUBRIC_SLUGS.has(s) ? s : undefined;
}

/** Strips the standard “At a glance” / legacy “Главное” heading block + bullets so dek does not duplicate the body. */
function stripLeadingTakeawaysBlock(md: string): string {
  const lines = md.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i >= lines.length) return md;
  const first = lines[i].trim();
  if (!/^###\s*(Главное|At a glance|Key takeaways?|Summary|TL;DR)\s*:?$/i.test(first)) return md;
  i++;
  while (i < lines.length && lines[i].trim() === '') i++;
  while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) i++;
  while (i < lines.length && lines[i].trim() === '') i++;
  const rest = lines.slice(i).join('\n');
  return rest.trim() ? rest : md;
}

export function rowToNewsArticle(row: Record<string, unknown>): NewsArticle | null {
  const slug = typeof row.slug === 'string' ? row.slug.trim() : '';
  if (!slug) return null;
  const id = String(row.id ?? '');
  const title = String(row.title ?? '');
  const content_md = String(row.content_md ?? '');
  const tags = Array.isArray(row.tags) ? (row.tags as string[]).filter((t) => typeof t === 'string') : [];
  const cover_url = normalizeCoverUrl(typeof row.cover_url === 'string' ? row.cover_url : '');
  const ct = row.cover_type;
  const cover_type: 'company' | 'abstract' | undefined =
    ct === 'company' || ct === 'abstract' ? ct : undefined;
  const created_at = typeof row.created_at === 'string' ? row.created_at : new Date().toISOString();
  const source_url = typeof row.source_url === 'string' ? row.source_url : '';
  const sentiment = typeof row.sentiment === 'number' ? row.sentiment : 5;
  let faq: { q: string; a: string }[] = [];
  if (Array.isArray(row.faq)) {
    faq = row.faq
      .filter((x): x is { q: string; a: string } => x && typeof x === 'object' && 'q' in x && 'a' in x)
      .map((x) => ({ q: String(x.q), a: String(x.a) }));
  }
  let entities: { name: string; desc: string }[] = [];
  if (Array.isArray(row.entities)) {
    entities = row.entities
      .filter((x): x is { name: string; desc: string } => x && typeof x === 'object' && 'name' in x)
      .map((x) => ({ name: String(x.name), desc: String((x as { desc?: string }).desc ?? '') }));
  }
  const storedDek = typeof row.dek === 'string' ? row.dek.replace(/\s+/g, ' ').trim() : '';
  const fallbackDek = excerptFromMarkdown(stripLeadingTakeawaysBlock(content_md), 280);
  const dek = storedDek || fallbackDek;
  const excerpt = clipListingExcerpt(dek);
  const primary_rubric = normalizeStoredPrimaryRubric(row.primary_rubric);
  return {
    id,
    slug,
    title,
    dek,
    excerpt,
    primary_rubric,
    content_md,
    cover_url,
    cover_type,
    tags,
    created_at,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : undefined,
    source_url,
    faq,
    entities,
    sentiment
  };
}

function toMock(a: NewsArticle): MockArticle {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    cover_url: a.cover_url,
    cover_type: a.cover_type,
    tags: a.tags,
    created_at: a.created_at,
    primary_rubric: a.primary_rubric
  };
}

/** River size under the lead story on the home page (page 1 shows lead + this many cards). */
export const HOME_RIVER_PAGE_SIZE = 15;
/** Rubric and tag listing page size. */
export const LISTING_PAGE_SIZE = 15;
/** Max articles loaded when filtering by tag/section in memory (same slugify rule as `articleMatchesTopic`). */
export const TOPIC_LISTING_FETCH_CAP = 2000;
/** Header Topics menu: how many published rows to scan for section/tag counts (needs `primary_rubric` from DB). */
export const TOPIC_NAV_INDEX_CAP = TOPIC_LISTING_FETCH_CAP;

export type TopicIndexPoolArticle = { tags: string[]; primary_rubric?: string };

/**
 * Lightweight rows for `buildTopicIndex` — not the same as listing cards (no 60-item cap from home).
 */
export async function getTopicIndexPool(): Promise<TopicIndexPoolArticle[]> {
  const supabase = getServerClient();
  if (!supabase) {
    return ARTICLES.map((a) => ({ tags: a.tags, primary_rubric: a.primary_rubric }));
  }

  let { data, error } = await supabase
    .from('articles')
    .select('tags, primary_rubric')
    .eq('status', 'published')
    .not('slug', 'is', null)
    .order('created_at', { ascending: false })
    .limit(TOPIC_NAV_INDEX_CAP);

  if (error && shouldRetryArticleSelectWithoutNewColumns(error)) {
    ({ data, error } = await supabase
      .from('articles')
      .select('tags')
      .eq('status', 'published')
      .not('slug', 'is', null)
      .order('created_at', { ascending: false })
      .limit(TOPIC_NAV_INDEX_CAP));
  }

  if (error || !data?.length) {
    return ARTICLES.map((a) => ({ tags: a.tags, primary_rubric: a.primary_rubric }));
  }

  return data.map((row) => ({
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    primary_rubric: normalizeStoredPrimaryRubric(
      (row as { primary_rubric?: unknown }).primary_rubric
    )
  }));
}

function sortedMockFallback(): MockArticle[] {
  return [...MOCK_FALLBACK].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function getPublishedArticleCount(): Promise<number> {
  const supabase = getServerClient();
  if (!supabase) return sortedMockFallback().length;

  const { count, error } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')
    .not('slug', 'is', null);

  if (error || count == null) return sortedMockFallback().length;
  return count;
}

/**
 * Published listing slice, newest first. `offset` is 0-based in the full ordered list.
 */
export async function getListingArticlesRange(offset: number, limit: number): Promise<MockArticle[]> {
  if (limit <= 0) return [];
  const supabase = getServerClient();
  if (!supabase) {
    return sortedMockFallback().slice(offset, offset + limit);
  }

  const end = offset + limit - 1;
  let { data, error } = await supabase
    .from('articles')
    .select(CARD_FIELDS)
    .eq('status', 'published')
    .not('slug', 'is', null)
    .order('created_at', { ascending: false })
    .range(offset, end);

  if (error && shouldRetryArticleSelectWithoutNewColumns(error)) {
    ({ data, error } = await supabase
      .from('articles')
      .select(CARD_FIELDS_CORE)
      .eq('status', 'published')
      .not('slug', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, end));
  }

  if (error || !data?.length) {
    return sortedMockFallback().slice(offset, offset + limit);
  }

  const out: MockArticle[] = [];
  for (const row of data) {
    const a = rowToNewsArticle(row as Record<string, unknown>);
    if (a) out.push(toMock(a));
  }
  return out;
}

export function parseListingPageParam(raw: string | null): number {
  const n = parseInt(raw ?? '1', 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function homeListingTotalPages(totalArticles: number): number {
  if (totalArticles <= 0) return 1;
  const first = Math.min(totalArticles, 1 + HOME_RIVER_PAGE_SIZE);
  const rest = totalArticles - first;
  if (rest <= 0) return 1;
  return 1 + Math.ceil(rest / HOME_RIVER_PAGE_SIZE);
}

function homeListingRange(page: number, totalArticles: number): { offset: number; limit: number } {
  /* Count can be 0 while rows still exist (RLS quirks); never use limit 0 on page 1 or the river stays empty. */
  if (totalArticles <= 0) {
    if (page <= 1) return { offset: 0, limit: 1 + HOME_RIVER_PAGE_SIZE };
    return { offset: 0, limit: 0 };
  }
  if (page <= 1) {
    return { offset: 0, limit: Math.min(totalArticles, 1 + HOME_RIVER_PAGE_SIZE) };
  }
  const first = Math.min(totalArticles, 1 + HOME_RIVER_PAGE_SIZE);
  const offset = first + (page - 2) * HOME_RIVER_PAGE_SIZE;
  const limit = Math.min(HOME_RIVER_PAGE_SIZE, Math.max(0, totalArticles - offset));
  return { offset, limit };
}

export async function getHomeListingPage(requestedPage: number): Promise<{
  featured: MockArticle | null;
  river: MockArticle[];
  total: number;
  totalPages: number;
  page: number;
}> {
  const total = await getPublishedArticleCount();
  const totalPages = homeListingTotalPages(total);
  const page = Math.min(requestedPage, totalPages);
  const { offset, limit } = homeListingRange(page, total);
  const rows = await getListingArticlesRange(offset, limit);

  if (page <= 1) {
    const [first, ...rest] = rows;
    return {
      featured: first ?? null,
      river: rest,
      total,
      totalPages,
      page
    };
  }

  return { featured: null, river: rows, total, totalPages, page };
}

/** Listing cards for home, rubrics, tags: from DB plus static fallback. */
export async function getListingArticles(limit = 80): Promise<MockArticle[]> {
  const supabase = getServerClient();
  if (!supabase) return MOCK_FALLBACK;

  let { data, error } = await supabase
    .from('articles')
    .select(CARD_FIELDS)
    .eq('status', 'published')
    .not('slug', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error && shouldRetryArticleSelectWithoutNewColumns(error)) {
    ({ data, error } = await supabase
      .from('articles')
      .select(CARD_FIELDS_CORE)
      .eq('status', 'published')
      .not('slug', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit));
  }

  if (error || !data?.length) {
    return MOCK_FALLBACK;
  }

  const out: MockArticle[] = [];
  for (const row of data) {
    const a = rowToNewsArticle(row as Record<string, unknown>);
    if (a) out.push(toMock(a));
  }
  return out.length ? out : MOCK_FALLBACK;
}

export async function getNewsArticleBySlug(slug: string): Promise<NewsArticle | null> {
  if (!slug) return null;
  const supabase = getServerClient();
  if (!supabase) {
    return getStaticArticleBySlug(slug) ?? null;
  }

  let { data, error } = await supabase
    .from('articles')
    .select(CARD_FIELDS)
    .eq('status', 'published')
    .eq('slug', slug)
    .maybeSingle();

  if (error && shouldRetryArticleSelectWithoutNewColumns(error)) {
    ({ data, error } = await supabase
      .from('articles')
      .select(CARD_FIELDS_CORE)
      .eq('status', 'published')
      .eq('slug', slug)
      .maybeSingle());
  }

  if (error || !data) {
    return getStaticArticleBySlug(slug) ?? null;
  }

  return rowToNewsArticle(data as Record<string, unknown>);
}

export async function getRelatedArticles(
  excludeSlug: string,
  tagHints: string[],
  limit = 6
): Promise<{ slug: string; title: string; cover_url: string }[]> {
  const supabase = getServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('articles')
    .select('slug, title, cover_url, tags, created_at')
    .eq('status', 'published')
    .not('slug', 'is', null)
    .neq('slug', excludeSlug)
    .order('created_at', { ascending: false })
    .limit(40);

  if (error || !data?.length) return [];

  const hints = new Set(tagHints.map((t) => t.toLowerCase()));
  const scored = data
    .filter((r) => typeof r.slug === 'string')
    .map((r) => {
      const tags = Array.isArray(r.tags) ? (r.tags as string[]) : [];
      let score = 0;
      for (const t of tags) {
        if (hints.has(t.toLowerCase())) score += 2;
      }
      return {
        slug: r.slug as string,
        title: String(r.title ?? ''),
        cover_url: normalizeCoverUrl(String(r.cover_url ?? '')),
        score,
        t: new Date(String(r.created_at ?? 0)).getTime()
      };
    })
    .sort((a, b) => b.score - a.score || b.t - a.t)
    .slice(0, limit);

  return scored.map(({ slug, title, cover_url }) => ({ slug, title, cover_url }));
}

export async function getPrevNextByDate(
  createdAt: string,
  excludeSlug: string
): Promise<{ prev: { slug: string; title: string } | null; next: { slug: string; title: string } | null }> {
  const supabase = getServerClient();
  if (!supabase) {
    return { prev: null, next: null };
  }

  const t = createdAt;

  const { data: older } = await supabase
    .from('articles')
    .select('slug, title, created_at')
    .eq('status', 'published')
    .not('slug', 'is', null)
    .neq('slug', excludeSlug)
    .lt('created_at', t)
    .order('created_at', { ascending: false })
    .limit(1);

  const { data: newer } = await supabase
    .from('articles')
    .select('slug, title, created_at')
    .eq('status', 'published')
    .not('slug', 'is', null)
    .neq('slug', excludeSlug)
    .gt('created_at', t)
    .order('created_at', { ascending: true })
    .limit(1);

  const prevRow = older?.[0];
  const nextRow = newer?.[0];

  return {
    prev:
      prevRow && typeof prevRow.slug === 'string'
        ? { slug: prevRow.slug, title: String(prevRow.title ?? '') }
        : null,
    next:
      nextRow && typeof nextRow.slug === 'string'
        ? { slug: nextRow.slug, title: String(nextRow.title ?? '') }
        : null
  };
}

/** For semantic cross-linking: pool of slug+tags from recent articles. */
export async function getTaxonomyArticlePool(
  limit = 120
): Promise<{ slug: string; tags: string[]; primary_rubric?: string }[]> {
  const supabase = getServerClient();
  if (!supabase) {
    return ARTICLES.map((a) => ({
      slug: a.slug,
      tags: a.tags,
      primary_rubric: a.primary_rubric
    }));
  }

  let { data, error } = await supabase
    .from('articles')
    .select('slug, tags, primary_rubric')
    .eq('status', 'published')
    .not('slug', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error && shouldRetryArticleSelectWithoutNewColumns(error)) {
    ({ data, error } = await supabase
      .from('articles')
      .select('slug, tags')
      .eq('status', 'published')
      .not('slug', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit));
  }

  if (error || !data?.length) {
    return ARTICLES.map((a) => ({
      slug: a.slug,
      tags: a.tags,
      primary_rubric: a.primary_rubric
    }));
  }

  return data
    .filter((r) => typeof r.slug === 'string')
    .map((r) => ({
      slug: r.slug as string,
      tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
      primary_rubric: normalizeStoredPrimaryRubric(
        (r as { primary_rubric?: unknown }).primary_rubric
      )
    }));
}

export async function listAllPublishedSlugs(): Promise<string[]> {
  const supabase = getServerClient();
  if (!supabase) return ARTICLES.map((a) => a.slug);

  const { data, error } = await supabase.from('articles').select('slug').eq('status', 'published').not('slug', 'is', null);

  if (error || !data) return ARTICLES.map((a) => a.slug);
  return data.map((r) => r.slug).filter((s): s is string => typeof s === 'string');
}

export async function getArticleIdSlugMap(): Promise<Map<string, string>> {
  const supabase = getServerClient();
  const map = new Map<string, string>();
  if (!supabase) {
    for (const a of ARTICLES) map.set(a.id, a.slug);
    return map;
  }

  const { data, error } = await supabase.from('articles').select('id, slug').eq('status', 'published').not('slug', 'is', null);

  if (!error && data) {
    for (const r of data) {
      if (r.id && r.slug) map.set(String(r.id), String(r.slug));
    }
  }
  if (map.size === 0) {
    for (const a of ARTICLES) map.set(a.id, a.slug);
  }
  return map;
}
