# Pipeline Architecture — 4 Parallel Phases

## Core Insight

Фазы НЕ последовательны. Каждая статья проходит через ВСЕ фазы одновременно:

```
Source → Dedup → Rewrite → Publish → SEO/Index → Discover/Distribute
```

Каждый шаг — это часть одной из фаз, но они работают в одном пайплайне.

---

## Архитектура пайплайна

### Фаза 1 (Technical) — встроена в каждый шаг
- JSON-LD на каждую статью → генерируется при создании
- OG tags + max-image-preview → при рендере страницы
- Internal links (related) → при публикации (post-build)
- GSC API submit → после каждого коммита
- ✅ Уже автоматизировано, добавляем missing pieces

### Фаза 2 (Content) — ядро пайплайна
```
Scrape Sources → Deduplicate → Score → Rewrite → Quality Check → Publish
```

### Фаза 3 (Discover + Links) — после публикации
```
Auto-submit to HN/Reddit/Dev.to → Track backlinks → Measure CTR → Adjust
```

### Фаза 4 (Scale) — мета-слой
```
Monitor sources health → Add new sources → Expand categories → Measure DA
```

---

## Deduplication System

### 3 уровня проверки:
1. **URL match** (exact) — уже работает в auto-publish
2. **Fuzzy title match** — разные источники, одна история
   - Jaccard similarity на токенизированных заголовках (>0.6 = duplicate)
   - Same key entities + same day (±24h) = likely duplicate
3. **Topic + date proximity** — одинаковый event от разных авторов
   - Если 2+ статьи за 24h о том же компании/ивенте → берём лучший source

---

## Source Expansion Strategy

### Текущий стек (3 источника):
- theneuron.ai
- decrypt.co
- techstartups.com

### Roadmap добавления (1-2 в неделю):

**Week 1 (сейчас):**
4. TechCrunch RSS — techcrunch.com/feed/
5. Ars Technica — arstechnica.com/feed/
6. VentureBeat RSS — venturebeat.com/feed/

**Week 2:**
7. The Verge — theverge.com/rss/index.xml
8. Wired — wired.com/feed/rss
9. MIT Technology Review — technologyreview.com/feed/

**Week 3:**
10. Bloomberg Tech (RSS)
11. HackerNews (API) — top stories, not the site
12. CNBC Tech RSS

**Week 4:**
13. Reuters Technology
14. The Information (если найдём RSS)
15. 9to5Mac / 9to5Google — для gadget category

### Источник-пер-категорию:
| Категория | Рекомендуемые источники |
|-----------|-------------------------|
| AI/ML | TheNeuron, Ars Technica AI, MIT Tech Review |
| Crypto | Decrypt, CoinDesk |
| Hardware | The Verge, AnandTech (archived), Tom's Hardware |
| Cloud | TechCrunch Cloud, VentureBeat |
| Startups | VentureBeat, TechCrunch, HackerNews |
| Cybersecurity | Ars Technica Security, Krebs on Security |
| Gaming | IGN, Kotaku, PC Gamer |
| Space | Ars Technica Space, SpaceNews |
| Gadgets | The Verge, 9to5Mac |

Каждый источник — отдельная scrape-функция, добавляется за 5 минут.

---

## Auto-Publish Flow (new design)

```javascript
// Каждый run (каждые 2 часа):
1. Scrape ALL sources (parallel)
2. Deduplicate:
   a. URL exact match → skip
   b. Fuzzy title + date match → skip if similar enough
   c. Pick best source (quality score per source)
3. Score articles:
   - Trending entities (high score)
   - Multiple sources covering (higher score)
   - Source quality weight
4. Select top N (2-3 per run, gradual increase)
5. For each selected:
   a. Fetch full article
   b. Rewrite with proper structure
   c. Add JSON-LD (NewsArticle, BreadcrumbList)
   d. Add FAQ (5 questions)
   e. Generate tags from entities
   f. Quality check (no stock photos, readability)
6. Write markdown files
7. Commit + push → Vercel builds
8. Submit URL to GSC Indexing API
9. Post to external platforms (HN, Reddit, etc.)
10. Log everything for analytics
```

---

## Volume Scaling

| Week | Sources/Run | Articles/Run | Daily Total | Monthly |
|------|-------------|--------------|-------------|---------|
| 1-2 | 3-5 | 2-3 | 12-18 | 75-110 |
| 3-4 | 6-8 | 3-4 | 18-24 | 110-160 |
| 5-8 | 10-12 | 3-4 | 18-24 | 200-350 |
| 9+ | 15 | 4-5 | 24-36 | 350-600+ |

### Gradual increase prevents:
- Google spam detection
- Duplicate content penalties
- Quality degradation
- Server overload

---

## Anti-Penalty Measures

1. **No duplicates** — 3-level dedup
2. **Varied writing style** — разные шаблоны для разных категорий
3. **Natural publish cadence** — 2-3 статьи каждые 2 часа, не все сразу
4. **Source attribution** — скрытая ссылка "via SourceName" для SEO value
5. **Original intro** — каждая статья начинается с уникального lead
6. **Different tag combos** — не шаблонные, а извлечённые из контента
