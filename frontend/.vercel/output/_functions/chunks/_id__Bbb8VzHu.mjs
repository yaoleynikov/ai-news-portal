import { c as createComponent } from './astro-component_A8P-NjRK.mjs';
import 'piccolore';
import { l as renderComponent, r as renderTemplate, m as maybeRenderHead, h as addAttribute, u as unescapeHTML } from './entrypoint_CAkyEWrj.mjs';
import { $ as $$Layout } from './Layout_BaMJTPhJ.mjs';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const $$id = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$id;
  const { id } = Astro2.params;
  const article = {
    title: "Openclaw запускает автономные фреймворки для новостных агентов",
    content_md: "## Введение\n\nНовая система обещает снизить нагрузку на серверы и позволить ИИ-агентам самостоятельно находить и переписывать новости без GPU-кластеров. Это позволит компаниям существенно экономить на инфраструктуре.\n\n## Архитектура N100\n\nРабота на минималках стала возможна благодаря использованию моделей, которые помещаются в RAM и не требуют видеоускорителей. Такие решения идеально подходят для стартапов с нулевым бюджетом.",
    cover_url: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=1200",
    tags: ["AI", "Openclaw", "Automation"],
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    source_url: "https://techcrunch.com/2026/04/07/openclaw-framework/",
    faq: [
      { q: "Зачем нужен Openclaw?", a: "Для снижения нагрузки на серверы ИИ-агентов." },
      { q: "Какое оборудование требуется?", a: "Достаточно энергоэффективного Intel N100 без GPU." },
      { q: "Это бесплатно?", a: "Используются бесплатные API, бюджет на инфраструктуру около нуля." }
    ],
    entities: [
      { name: "Openclaw", desc: "Фреймворк для агентов" },
      { name: "Intel", desc: "Производитель чипов (N100)" }
    ],
    sentiment: 8
    // Bullish
  };
  const relatedArticles = [
    { id: "uuid-2", title: "Intel N100 становится стандартом для легковесных AI серверов", cover_url: "https://images.unsplash.com/photo-1591405351990-4726e331f141?q=80&w=600" },
    { id: "uuid-3", title: "Supabase выпускает pgvector 2.0 для сверхбыстрого поиска по векторам", cover_url: "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?q=80&w=600" }
  ];
  const rawHtml = marked.parse(article.content_md);
  const htmlContent = sanitizeHtml(rawHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"])
  });
  const newsLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": article.title,
    "image": [article.cover_url],
    "datePublished": article.created_at,
    "dateModified": article.created_at,
    "author": [{
      "@type": "Organization",
      "name": "SiliconFeed AI",
      "url": "https://siliconfeed.online"
    }]
  };
  const breadcrumLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Главная", "item": "https://siliconfeed.online/" },
      { "@type": "ListItem", "position": 2, "name": article.tags[0] || "Новости", "item": `https://siliconfeed.online/tag/${article.tags[0]}` }
    ]
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": (article.faq || []).map((f) => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": f.a
      }
    }))
  };
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": article.title, "description": article.content_md.substring(0, 160).replace(/[#*]/g, "") + "...", "ogImage": article.cover_url, "jsonLd": [newsLd, breadcrumLd, faqLd] }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<article class="glass" style="max-width: 800px; margin: 0 auto; padding: 40px; overflow: hidden;"> <!-- Featured Image with CLS Protection (aspect-ratio) --> <img${addAttribute(article.cover_url, "src")}${addAttribute(article.title, "alt")} style="width: calc(100% + 80px); margin: -40px -40px 30px -40px; aspect-ratio: 1200 / 630; object-fit: cover; display: block;"> <!-- Meta --> <div style="display: flex; gap: 10px; margin-bottom: 20px;"> ${article.tags.map((tag) => renderTemplate`<span style="font-size: 0.8rem; font-weight: 600; text-transform: uppercase; padding: 5px 12px; background: var(--accent-glow); border-radius: 20px; color: var(--accent);">${tag}</span>`)} <span style="margin-left: auto; color: var(--text-muted); font-size: 0.85rem; font-weight: 500;"> ${new Date(article.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })} </span> </div> <!-- Title --> <h1 style="font-size: 2.8rem; margin-bottom: 30px; letter-spacing: -0.04em;">${article.title}</h1> <div style="display: grid; grid-template-columns: 1fr; gap: 40px; align-items: start;"> <!-- Main Content Column --> <div> <div class="prose">${unescapeHTML(htmlContent)}</div> </div> <!-- Sticky Right Column / Proprietary Data --> <aside style="position: sticky; top: 30px; display: flex; flex-direction: column; gap: 20px;"> <!-- Sentiment Meter --> <div style="background: var(--bg-surface); padding: 25px; border-radius: var(--radius-md); border: 1px solid var(--border-light); box-shadow: 0 4px 15px rgba(0,0,0,0.02);"> <h4 style="margin: 0 0 10px 0; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">AI Индекс влияния</h4> <div style="display: flex; align-items: center; gap: 15px;"> <div style="font-size: 2.2rem; font-weight: 800; color: {article.sentiment >= 7 ? '#10b981' : (article.sentiment < 5 ? '#ef4444' : '#f59e0b')};"> ${article.sentiment}/10
</div> <div style="flex: 1; background: var(--border-light); height: 8px; border-radius: 4px; overflow: hidden;"> <div style="height: 100%; width: {article.sentiment * 10}%; background: {article.sentiment >= 7 ? '#10b981' : (article.sentiment < 5 ? '#ef4444' : '#f59e0b')}; transition: width 1s ease-out;"></div> </div> </div> <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 5px; font-weight: 500;"> ${"🚀 Бычий тренд (Позитив)" } </div> </div> <!-- Entity Dossier --> <div style="background: var(--bg-surface); padding: 25px; border-radius: var(--radius-md); border: 1px solid var(--border-light); box-shadow: 0 4px 15px rgba(0,0,0,0.02);"> <h4 style="margin: 0 0 15px 0; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Досье (Сводка)</h4> <div style="display: flex; flex-direction: column; gap: 12px;"> ${(article.entities || []).map((ent) => renderTemplate`<div> <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${ent.name}</div> <div style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.4;">${ent.desc}</div> </div>`)} </div> </div> </aside> </div> <!-- AI Semantic Vector Internal Linking --> <div style="margin-top: 60px; padding-top: 40px; border-top: 1px solid var(--border-light);"> <!-- FAQ Accordion --> ${article.faq && article.faq.length > 0 && renderTemplate`<div style="margin-bottom: 50px;"> <h3 style="font-size: 1.5rem; margin-bottom: 25px;">Частые вопросы (AI-досье):</h3> <div style="display: flex; flex-direction: column; gap: 15px;"> ${article.faq.map((f) => renderTemplate`<details style="background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 15px 20px; cursor: pointer; box-shadow: 0 2px 10px rgba(0,0,0,0.02);"> <summary style="font-weight: 600; font-size: 1.1rem; color: var(--text-main); outline: none;">${f.q}</summary> <div style="margin-top: 15px; color: var(--text-muted); line-height: 1.6; font-size: 0.95rem;"> ${f.a} </div> </details>`)} </div> </div>`} <h3 style="font-size: 1.5rem; margin-bottom: 25px;">Читайте также по теме:</h3> <div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 25px;"> ${relatedArticles.map((rel) => renderTemplate`<a${addAttribute(`/article/${rel.id}`, "href")} class="glass card" style="text-decoration: none; display: block; overflow: hidden; border-radius: var(--radius-md);"> <img${addAttribute(rel.cover_url, "src")}${addAttribute(rel.title, "alt")} style="width: 100%; height: 160px; object-fit: cover; border-bottom: 1px solid var(--border-light);"> <div style="padding: 20px;"> <h4 style="margin: 0; font-size: 1.1rem; line-height: 1.4; color: var(--text-main);">${rel.title}</h4> </div> </a>`)} </div> </div> <!-- Legal & Attribution source link --> <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--border-light); font-size: 0.85rem;"> <p style="color: var(--text-muted);">
В основе данной новости лежат данные из внешнего источника. Сгенерировано нейросетью.
<br> <a${addAttribute(article.source_url, "href")} target="_blank" rel="nofollow noopener noreferrer" style="color: var(--accent); text-decoration: underline; font-weight: 500;">
Оригинал материала
</a> </p> </div> </article> ` })}`;
}, "A:/SiliconFeed/frontend/src/pages/article/[id].astro", void 0);

const $$file = "A:/SiliconFeed/frontend/src/pages/article/[id].astro";
const $$url = "/article/[id]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$id,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
