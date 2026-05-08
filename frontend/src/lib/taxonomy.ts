import { NAV_TOPICS, articleInRubric, articleMatchesTopic, slugifyTag } from './tags';
import { rubricPath, tagPath } from './seo';

type ArticleTagSource = { tags: string[]; primary_rubric?: string | null };
type ArticleWithDate = { created_at: string };

export type TopicKind = 'rubric' | 'tag';

export type TopicIndexEntry = {
  slug: string;
  label: string;
  kind: TopicKind;
  count: number;
  href: string;
};

/** Rubrics plus all tags from articles with counts and stable hrefs */
export function buildTopicIndex(articles: ArticleTagSource[]): TopicIndexEntry[] {
  const rubricSlugs = new Set(NAV_TOPICS.map((t) => t.slug));
  const slugToLabel = new Map<string, string>();
  const slugToCount = new Map<string, number>();

  for (const article of articles) {
    for (const tag of article.tags) {
      const s = slugifyTag(tag);
      slugToCount.set(s, (slugToCount.get(s) ?? 0) + 1);
      if (!slugToLabel.has(s)) slugToLabel.set(s, tag.trim());
    }
  }

  const rubrics: TopicIndexEntry[] = NAV_TOPICS.map(({ slug, label }) => ({
    slug,
    label,
    kind: 'rubric' as const,
    count: articles.filter((a) => articleInRubric(a, slug)).length,
    href: rubricPath(slug)
  }));

  const tags: TopicIndexEntry[] = [];
  for (const [slug, count] of slugToCount) {
    if (rubricSlugs.has(slug)) continue;
    tags.push({
      slug,
      label: slugToLabel.get(slug) ?? slug,
      kind: 'tag',
      count,
      href: tagPath(slug)
    });
  }

  tags.sort((a, b) => a.label.localeCompare(b.label, 'en'));
  return [...rubrics, ...tags];
}

export function publicationYears(articles: ArticleWithDate[]): number[] {
  const years = new Set<number>();
  for (const a of articles) {
    years.add(new Date(a.created_at).getFullYear());
  }
  return [...years].sort((a, b) => b - a);
}

/** Tags co-occurring on articles in the current topic — use scope `tag` on /tag/* so membership matches tag facets, not only primary_rubric. */
export function relatedTopicsForSlug(
  articles: ArticleTagSource[],
  currentSlug: string,
  limit = 12,
  scope: 'rubric' | 'tag' = 'rubric'
): { slug: string; label: string; count: number; href: string; kind: TopicKind }[] {
  const rubricSlugs = new Set(NAV_TOPICS.map((t) => t.slug));
  const inTopic = articles.filter((a) =>
    scope === 'tag'
      ? articleMatchesTopic(a.tags, currentSlug)
      : articleInRubric(a, currentSlug)
  );
  const acc = new Map<string, { label: string; count: number }>();

  for (const article of inTopic) {
    for (const tag of article.tags) {
      const s = slugifyTag(tag);
      if (s === currentSlug) continue;
      const cur = acc.get(s);
      if (!cur) acc.set(s, { label: tag.trim(), count: 1 });
      else cur.count += 1;
    }
  }

  return [...acc.entries()]
    .map(([slug, { label, count }]) => ({
      slug,
      label,
      count,
      kind: (rubricSlugs.has(slug) ? 'rubric' : 'tag') as TopicKind,
      href: rubricSlugs.has(slug) ? rubricPath(slug) : tagPath(slug)
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'en'))
    .slice(0, limit);
}

/** Tags from other articles that share tags with the current one — lateral cross-links */
export function relatedTopicsForArticle(
  article: { slug: string; tags: string[] },
  all: { slug: string; tags: string[] }[],
  limit = 10
): { slug: string; label: string; count: number; href: string; kind: TopicKind }[] {
  const mine = new Set(article.tags.map((t) => slugifyTag(t)));
  const rubricSlugs = new Set(NAV_TOPICS.map((t) => t.slug));
  const acc = new Map<string, { label: string; count: number }>();

  for (const other of all) {
    if (other.slug === article.slug) continue;
    const overlaps = other.tags.some((t) => mine.has(slugifyTag(t)));
    if (!overlaps) continue;
    for (const tag of other.tags) {
      const s = slugifyTag(tag);
      if (mine.has(s)) continue;
      const cur = acc.get(s);
      if (!cur) acc.set(s, { label: tag.trim(), count: 1 });
      else cur.count += 1;
    }
  }

  return [...acc.entries()]
    .map(([slug, { label, count }]) => ({
      slug,
      label,
      count,
      kind: (rubricSlugs.has(slug) ? 'rubric' : 'tag') as TopicKind,
      href: rubricSlugs.has(slug) ? rubricPath(slug) : tagPath(slug)
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'en'))
    .slice(0, limit);
}
