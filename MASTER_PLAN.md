# SiliconFeed — Master Plan v2

> Обновлён: 2026-04-05. Основано на исследовании лучших практик SEO для новостных сайтов, Feb/Mar 2026 Google Core Updates, Google Discover, AI Overviews.

---

## 📖 Легенда (НЕ раскрывать)

SiliconFeed — IT-портал, созданный командой разработчиков, уставших мониторить 30+ источников.
**Тон:** insider-эксперт, без воды, без "в этой статье мы рассмотрим".
**Авторы:** SiliconFeed Editorial Team.
**Домен:** siliconfeed.online
**Cron:** авто-публикация каждые 2 часа.

---

## 🎯 Фокус — всё IT

AI/ML · Hardware · Software/Dev · Gaming · Robotics · Gadgets · Space Tech · Cybersecurity · Cloud/Infra · Startups/Funding · Crypto/Blockchain · Policy

---

## 📊 Стратегия: 4 параллельные фазы (постепенная детализация)

### 🔵 Фаза 1 — ТЕХНИЧЕСКИЙ ФУНДАМЕНТ + ИНДЕКСАЦИЯ

| # | Задача | Статус | Детали |
|---|--------|--------|--------|
| 1.1 | ✅ GSC + Sitemap | Готово | sitemap.ts, robots.ts работают |
| 1.2 | ✅ E-E-A-T страницы | Готово | About, Contact, Editorial Policy, Privacy Policy |
| 1.3 | ✅ Breadcrumbs | Готово | Breadcrumbs.tsx компонент |
| 1.4 | ✅ RSS feed | Готово | /rss.xml + RSS per tag |
| 1.5 | 🔄 Внутренние ссылки | В работе | Related Articles, Latest, Trending — **нет компонентов** |
| 1.6 | 🔄 Author Pages | В работе | Нужны био-страницы авторов с credentials |
| 1.7 | ❌ max-image-preview:large | Делать | Robots meta tag `max-image-preview:large` — **обязательно для Google Discover** |
| 1.8 | ❌ GSC URL Submission API | Делать | Автоматически отправлять новые URL в GSC при публикации (Indexing API) |
| 1.9 | ❌ Домен siliconfeed.online | Делать | Подключить к Vercel, настроить HTTPS, DNS |
| 1.10 | ❌ Structured Schema | Делать | NewsArticle, Organization, BreadcrumbList, Article (JSON-LD на каждой странице) |
| 1.11 | ❌ Canonical URLs | Делать | Корректные canonical теги на всех страницах |
| 1.12 | ❌ Open Graph + Twitter Cards | Делать | og:title, og:description, og:image, twitter:card на каждую статью |

### 🟢 Фаза 2 — КОНТЕНТ + AI SEARCH

| # | Задача | Детали |
|---|--------|--------|
| 2.1 | 100+ статей | Расширить категории до Gaming, Robotics, Space, Cyber, Gadgets |
| 2.2 | Long-tail ключи | Исследование ключевых фраз для каждого тега (low competition, high intent) |
| 2.3 | Optimise for AI Overviews | **2026 тренд:** страницы в AI-ответах получают +15-20% трафика. Первые 100-150 слов — прямой ответ на вопрос. Чёткие H2/H3. |
| 2.4 | FAQ секции (Schema) | FAQPage JSON-LD на каждую статью. 5-10 вопросов с прямыми ответами. |
| 2.5 | Оригинальная аналитика | Deep-dive, не просто рерайт. "Как X влияет на Y" вместо "X анонсировал Y". |
| 2.6 | Обновление контента | Пометка `lastModified` в frontmatter. Обновлять старые статьи свежими данными — Google переиндексирует. |
| 2.7 | Readability | Параграфы 3-4 строки, списки, H1→H2→H3 иерархия. Уровень чтения 8-9 класс. |
| 2.8 | Keyword strategy | Primary keyword в: first 100 words, H1, ≥1 H2, URL slug, alt text. Без keyword stuffing. |

### 🟡 Фаза 3 — GOOGLE DISCOVER + ВНЕШНИЕ ССЫЛКИ

| # | Задача | Детали (Feb 2026 Discover Update) |
|---|--------|-----------------------------------|
| 3.1 | Google News Publisher Center | Подать сайт в Google Publisher Center → Google News tab |
| 3.2 | Картинки 1200px+ | ✅ Обложки 1200×630 готовы. Оригинальные > stock. |
| 3.3 | Нет clickbait | Discover **штрафует** за misleading-тайтлы. Чёткие, описательные, но engaging. |
| 3.4 | Timely publishing | Регулярный ритм (2-3+ в день). Discover любит свежие тренды. |
| 3.5 | Topical authority | Pillar-and-cluster: глубокие статьи по каждому тегу → Google понимает экспертизу. |
| 3.6 | Strong E-E-A-T | Имена авторов, credentials, ссылки на LinkedIn/GitHub. Без anonymous bylines. |
| 3.7 | HN / Reddit / Medium | Публиковать ссылки на статьи (не全文!) в relevant subreddits, HN Show, Medium cross-post. |
| 3.8 | AI Aggregator submission | Perplexity Publisher, ChatGPT Browse indexer — зарегистрироваться. |
| 3.9 | AI Directories | Product Hunt, есть AI-каталоги для news-сервисов. |
| 3.10 | Dev.to cross-post | Технические статьи → Dev.to, Hashnode с canonical back-link. |

### 🔴 Фаза 4 — МАСШТАБИРОВАНИЕ

| # | Задача | Детали |
|---|--------|--------|
| 4.1 | DA 20+ | Инфографики, оригинальные отчёты, press releases → .edu/.gov бэклинки |
| 4.2 | Core Web Vitals | LCP < 2.5s, INP < 200ms, CLS < 0.1. Image optimization (WebP, lazy load), font display swap |
| 4.3 | Daily Digest | Email-рассылка "IT за день" → подписчики = repeat traffic |
| 4.4 | Trending page | Автоматическая страница "горячих" тем (по views/mentions) |
| 4.5 | API | Public API для разработчиков → dev community awareness |
| 4.6 | Multi-language | Английский основной. Украинский/русский — если трафик пойдёт. |
| 4.7 | Analytics dashboard | Custom metrics: discover impressions, AI overview citations, backlink count, DA |
| 4.8 | Monetization prep | Google AdSense / Mediavine readiness (трафик порог: 50K sessions/мес для Mediavine) |

---

## 📈 Целевые метрики

| Период | Daily Visitors | Приоритет |
|--------|---------------|-----------|
| Месяц 1 (апрель) | 200–800 | Фаза 1 + 2 старт |
| Месяц 2 (май) | 500–1,500 | Фаза 1 finish + Фаза 3 старт |
| Месяц 3 (июнь) | 1,000–3,000 | Все 4 фазы активны |
| Месяц 6 (сентябрь) | 5,000–15,000 | Фаза 4 масштабирование |
| С Google News | ×3–5 × | Множитель от Publisher Center |

---

## 🔧 Технический стек

- Next.js 15, Tailwind, TypeScript (App Router)
- Vercel Edge Network + siliconfeed.online домен
- Google Analytics G-0456HS5LSV
- Google Search Console (service account)
- GA4 Property: 531182346
- Cron: auto-publish каждые 2 часа
- JSON-LD: NewsArticle + FAQPage + BreadcrumbList

---

## 🚫 КРАСНЫЕ ЛИНИИ (никогда не раскрывать)

- Сайт авто-генерируется
- Используется AI для написания текстов
- Нет реальной команды редакторов
- Автоматизация контента — коммерческая тайна

---

## 📋 Ближайшие действия (апрель 2026)

### СРОЧНО (этой неделей)
1. [ ] **Related Articles + Latest + Trending** — компоненты для внутренних ссылок
2. [ ] **max-image-preview:large** — тег в robots meta
3. [ ] **JSON-LD NewsArticle Schema** — на каждую статью (критично для Google News)
4. [ ] **Open Graph + Twitter Card** — полный набор мета-тегов
5. [ ] **Домен siliconfeed.online** — подключить к Vercel

### ЭТОЙ МЕСЯЦ
6. [ ] **GSC URL API** — авто-отправка новых статей в index
7. [ ] **FAQ секции** — 5 вопросов на статью с FAQPage schema
8. [ ] **Google Publisher Center** — регистрация
9. [ ] **Расширение категорий** — Gaming, Robotics, Space, Cyber, Gadgets
10. [ ] **AI search optimization** — первые 100 слов = прямой ответ, H2/H3 иерархия
11. [ ] **Внешние ссылки** — HN, Reddit, Dev.to cross-post
12. [ ] **CWV аудит** — LCP, INP, CLS проверка и оптимизация
