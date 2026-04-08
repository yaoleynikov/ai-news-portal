import rss from '@astrojs/rss';

async function GET(context) {
  // In production, fetch via supabase.from('articles')
  return rss({
    title: 'SiliconFeed',
    description: 'Лента свежих IT и технологических новостей.',
    site: context.site,
    items: [
      {
        title: 'Openclaw запускает автономные фреймворки',
        pubDate: new Date(),
        description: 'Новая система обещает снизить нагрузку на серверы и позволить ИИ-агентам самостоятельно находить и переписывать новости без GPU-кластеров...',
        link: `/article/uuid-1/`,
      },
    ],
    customData: `<language>ru</language>`,
  });
}

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
