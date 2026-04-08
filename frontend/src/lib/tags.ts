import { rubricPath } from './seo';

export const NAV_TOPICS = [
  { slug: 'ai', label: 'AI' },
  { slug: 'hardware', label: 'Hardware' },
  { slug: 'open-source', label: 'Open Source' }
] as const;

export type TopicSlug = (typeof NAV_TOPICS)[number]['slug'];

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
