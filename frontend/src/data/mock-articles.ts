import { ARTICLES, type NewsArticle } from './news';

/** Card in feed and tag pages (no full body). */
export type MockArticle = Pick<
  NewsArticle,
  'id' | 'slug' | 'title' | 'excerpt' | 'cover_url' | 'tags' | 'created_at' | 'cover_type' | 'primary_rubric'
>;

export const MOCK_ARTICLES: MockArticle[] = ARTICLES.map(
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
