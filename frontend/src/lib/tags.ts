import { rubricPath } from './seo';

export const NAV_TOPICS = [
  { slug: 'ai', label: 'AI' },
  { slug: 'hardware', label: 'Hardware' },
  { slug: 'open-source', label: 'Open Source' },
  { slug: 'other', label: 'More' }
] as const;

export type TopicSlug = (typeof NAV_TOPICS)[number]['slug'];

const MAIN_RUBRIC_SLUGS: readonly TopicSlug[] = ['ai', 'hardware', 'open-source'];

export function slugifyTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, '-');
}

export function tagUrl(tag: string): string {
  return `/tag/${slugifyTag(tag)}`;
}

/** Editorial section from the nav (stable URLs for SEO) */
export function rubricUrl(slug: TopicSlug | string): string {
  return rubricPath(slug);
}

/** Breadcrumbs: if the tag matches a rubric, use /rubric/; otherwise /tag/ */
export function topicOrTagUrl(tag: string): string {
  const s = slugifyTag(tag);
  if (NAV_TOPICS.some((t) => t.slug === s)) return rubricPath(s);
  return tagUrl(tag);
}

export function articleMatchesTopic(articleTags: string[], topicSlug: string): boolean {
  return articleTags.some((t) => slugifyTag(t) === topicSlug);
}

/**
 * Rubric lists (/rubric/*): prefer `primary_rubric` from the DB; if missing, fall back to tag slugs.
 * Legacy rows without `primary_rubric`: main sections use tag match; `other` is everything else.
 */
export function articleInRubric(
  article: { tags: string[]; primary_rubric?: string | null | undefined },
  topicSlug: string
): boolean {
  const pr =
    typeof article.primary_rubric === 'string' && article.primary_rubric.trim()
      ? article.primary_rubric.trim().toLowerCase()
      : '';
  if (pr) return pr === topicSlug;
  if (topicSlug === 'other') {
    return !MAIN_RUBRIC_SLUGS.some((s) => articleMatchesTopic(article.tags, s));
  }
  return articleMatchesTopic(article.tags, topicSlug);
}

/** Tag color theme for the UI (see global.css [data-tag-theme]) */
export type TagTheme = 'ai' | 'hardware' | 'open-source' | 'automation' | 'default';

export function tagThemeSlug(tag: string): TagTheme {
  const s = slugifyTag(tag);
  if (s === 'ai' || s === 'openclaw') return 'ai';
  if (s === 'hardware' || s === 'intel') return 'hardware';
  if (s === 'open-source' || s === 'linux') return 'open-source';
  if (s === 'automation') return 'automation';
  return 'default';
}

function rubricThemeFromSlug(slug: string): TagTheme {
  if (slug === 'ai') return 'ai';
  if (slug === 'hardware') return 'hardware';
  if (slug === 'open-source') return 'open-source';
  return 'default';
}

/** Kicker link above the headline: editorial section when `primary_rubric` is set. */
export function kickerFromArticle(article: {
  primary_rubric?: string | null | undefined;
  tags: string[];
}): { label: string; href: string; theme: TagTheme } {
  const pr =
    typeof article.primary_rubric === 'string' && article.primary_rubric.trim()
      ? article.primary_rubric.trim().toLowerCase()
      : '';
  if (pr && NAV_TOPICS.some((t) => t.slug === pr)) {
    const topic = NAV_TOPICS.find((t) => t.slug === pr)!;
    return {
      label: topic.label,
      href: rubricPath(pr),
      theme: rubricThemeFromSlug(pr)
    };
  }
  const first = article.tags[0] ?? 'News';
  return {
    label: first,
    href: topicOrTagUrl(first),
    theme: tagThemeSlug(first)
  };
}
