import { ARTICLES, type NewsArticle } from './news';

/** Карточка в ленте и на страницах тегов (без тела статьи) */
export type MockArticle = Pick<NewsArticle, 'id' | 'slug' | 'title' | 'excerpt' | 'cover_url' | 'tags' | 'created_at'>;

export const MOCK_ARTICLES: MockArticle[] = ARTICLES.map(
  ({ id, slug, title, excerpt, cover_url, tags, created_at }) => ({
    id,
    slug,
    title,
    excerpt,
    cover_url,
    tags,
    created_at
  })
);
