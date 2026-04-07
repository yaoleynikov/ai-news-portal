import rss from '@astrojs/rss';

export async function GET(context) {
  // In production, fetch via supabase.from('articles')
  return rss({
    title: 'SiliconFeed AI',
    description: 'Полностью автономная лента свежих IT и AI новостей.',
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
