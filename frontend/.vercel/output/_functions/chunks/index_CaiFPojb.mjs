import { c as createComponent } from './astro-component_C6jx-ULT.mjs';
import 'piccolore';
import { l as renderComponent, r as renderTemplate, m as maybeRenderHead, h as addAttribute } from './entrypoint_B4_iXJ1H.mjs';
import { $ as $$Layout } from './Layout_BmX5thgb.mjs';

const $$Index = createComponent(($$result, $$props, $$slots) => {
  const articles = [
    {
      id: "uuid-1",
      title: "Openclaw запускает автономные фреймворки для новостных агентов",
      excerpt: "Новая система обещает снизить нагрузку на серверы и позволить ИИ-агентам самостоятельно находить и переписывать новости без GPU-кластеров...",
      cover_url: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=1200",
      tags: ["AI", "Openclaw", "Automation"],
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "uuid-2",
      title: "Intel N100 становится стандартом для легковесных AI серверов",
      excerpt: "Энергоэффективные процессоры N100 внезапно обрели популярность среди разработчиков автономных микросервисов, позволив строить кластеры за копейки...",
      cover_url: "https://images.unsplash.com/photo-1591405351990-4726e331f141?q=80&w=1200",
      tags: ["Hardware", "Intel", "Hosting"],
      created_at: new Date(Date.now() - 864e5).toISOString()
    }
  ];
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Главная", "description": "Свежие инсайты из мира IT и искусственного интеллекта от автономной редакции SiliconFeed.", "data-astro-cid-j7pv25f6": true }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div style="margin-bottom: 60px; text-align: center; padding-top: 40px;" data-astro-cid-j7pv25f6> <h1 style="font-size: 4rem; margin-bottom: 15px; color: var(--text-main); font-weight: 800; letter-spacing: -0.05em;" data-astro-cid-j7pv25f6>SiliconFeed</h1> <p style="font-size: 1.25rem; color: var(--text-muted); max-width: 600px; margin: 0 auto; font-weight: 400;" data-astro-cid-j7pv25f6>Будущее IT журналистики. Автономно, быстро, объективно.</p> </div> <div class="grid" data-astro-cid-j7pv25f6> ${articles.map((article) => renderTemplate`<a${addAttribute(`/article/${article.id}`, "href")} class="glass card" data-astro-cid-j7pv25f6> <img${addAttribute(article.cover_url, "src")}${addAttribute(article.title, "alt")} class="card-cover" loading="lazy" data-astro-cid-j7pv25f6> <div class="card-content" data-astro-cid-j7pv25f6> <div class="tags" data-astro-cid-j7pv25f6> ${article.tags.map((tag) => renderTemplate`<span class="tag" data-astro-cid-j7pv25f6>${tag}</span>`)} </div> <h2 style="margin: 10px 0 15px 0; font-size: 1.5rem; line-height: 1.3;" data-astro-cid-j7pv25f6>${article.title}</h2> <p style="color: var(--text-muted); margin: 0; font-size: 0.95rem;" data-astro-cid-j7pv25f6>${article.excerpt}</p> </div> </a>`)} </div> ` })}`;
}, "A:/SiliconFeed/frontend/src/pages/index.astro", void 0);

const $$file = "A:/SiliconFeed/frontend/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
