/**
 * Единый источник материалов для ленты, SEO URL /news/[slug] и RSS.
 * В проде заменить на запрос к API/БД, slug хранить в записи.
 */

export type NewsArticle = {
  slug: string;
  id: string;
  title: string;
  dek: string;
  excerpt: string;
  content_md: string;
  cover_url: string;
  tags: string[];
  created_at: string;
  updated_at?: string;
  source_url: string;
  faq: { q: string; a: string }[];
  entities: { name: string; desc: string }[];
  sentiment: number;
};

export const ARTICLES: NewsArticle[] = [
  {
    slug: 'openclaw-news-agent-frameworks',
    id: 'uuid-1',
    title: 'Openclaw запускает автономные фреймворки для новостных агентов',
    dek: 'Без GPU и тяжёлой инфраструктуры: как агентные пайплайны переносятся на дешёвое железо и открытые API.',
    excerpt:
      'Новая система обещает снизить нагрузку на серверы и позволить ИИ-агентам самостоятельно находить и переписывать новости без GPU-кластеров...',
    content_md:
      '## Введение\n\nНовая система обещает снизить нагрузку на серверы и позволить ИИ-агентам самостоятельно находить и переписывать новости без GPU-кластеров. Это позволит компаниям существенно экономить на инфраструктуре.\n\n## Архитектура N100\n\nРабота на минималках стала возможна благодаря использованию моделей, которые помещаются в RAM и не требуют видеоускорителей. Такие решения идеально подходят для стартапов с нулевым бюджетом.',
    cover_url: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=1200',
    tags: ['AI', 'Openclaw', 'Automation'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source_url: 'https://techcrunch.com/2026/04/07/openclaw-framework/',
    faq: [
      { q: 'Зачем нужен Openclaw?', a: 'Для снижения нагрузки на серверы ИИ-агентов.' },
      { q: 'Какое оборудование требуется?', a: 'Достаточно энергоэффективного Intel N100 без GPU.' },
      { q: 'Это бесплатно?', a: 'Используются бесплатные API, бюджет на инфраструктуру около нуля.' }
    ],
    entities: [
      { name: 'Openclaw', desc: 'Фреймворк для агентов' },
      { name: 'Intel', desc: 'Производитель чипов (N100)' }
    ],
    sentiment: 8
  },
  {
    slug: 'intel-n100-lightweight-ai-servers',
    id: 'uuid-2',
    title: 'Intel N100 становится стандартом для легковесных AI серверов',
    dek: 'Микросерверы на N100 собирают энтузиасты и студии: низкое энергопотребление и цена платы важнее пикового FPS.',
    excerpt:
      'Энергоэффективные процессоры N100 внезапно обрели популярность среди разработчиков автономных микросервисов, позволив строить кластеры за копейки...',
    content_md:
      '## Контекст\n\nПроцессоры линейки Intel N100 давно позиционировались как решения для тонких клиентов и встраиваемых систем. В 2026 году их массово используют для фоновых воркеров, очередей и лёгких LLM-инференсов на CPU.\n\n## Практика\n\nТипичный узел — 8–16 ГБ RAM, без дискретной видеокарты, Docker и минимальный Linux. Такой кластер из четырёх узлов часто обходится дешевле одной игровой видеокарты прошлого поколения.',
    cover_url: 'https://images.unsplash.com/photo-1591405351990-4726e331f141?q=80&w=1200',
    tags: ['Hardware', 'Intel', 'Hosting'],
    created_at: new Date(Date.now() - 86400000).toISOString(),
    source_url: 'https://example.com/intel-n100-ai-hosting',
    faq: [
      { q: 'Хватит ли N100 для embeddings?', a: 'Для небольших батчей и офлайн-задач — да; для больших — смотрите latency и RAM.' },
      { q: 'Где брать платы?', a: 'Мини-ПК и SBC на N100 продают крупные маркетплейсы и OEM-сборщики.' }
    ],
    entities: [
      { name: 'Intel N100', desc: 'Энергоэффективный x86 SoC' },
      { name: 'Docker', desc: 'Контейнеризация сервисов' }
    ],
    sentiment: 6
  },
  {
    slug: 'linux-foundation-open-ai-stacks',
    id: 'uuid-3',
    title: 'Linux Foundation усиливает поддержку открытых AI-стеков',
    dek: 'Единые профили контейнеров и проверяемые билды: зачем enterprise смотрит на открытый inference и кто платит за совместимость.',
    excerpt:
      'Консорциум публикует дорожную карту совместимости для inference-серверов на открытом железе и в контейнерах OCI...',
    content_md:
      '## Сдвиг в сторону открытости\n\nКрупные вендоры всё чаще публикуют reference-стеки для CPU-inference без закрытых runtime. Linux Foundation предлагает общие спецификации для OCI-образов и эталонные docker-compose для пилотов.\n\n## Что это меняет\n\nИнтеграторам проще сравнивать задержку и стоимость владения: одинаковые entrypoint, явные версии библиотек и воспроизводимые бенчмарки.',
    cover_url: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?q=80&w=1200',
    tags: ['Open Source', 'AI', 'Linux'],
    created_at: new Date(Date.now() - 172800000).toISOString(),
    source_url: 'https://example.com/linux-foundation-open-ai',
    faq: [
      { q: 'Это только для Linux?', a: 'Акцент на открытых стеках; образы OCI работают и в других средах.' },
      { q: 'Где посмотреть спецификации?', a: 'Следите за репозиториями LF и рабочими группами по AI-инфраструктуре.' }
    ],
    entities: [
      { name: 'Linux Foundation', desc: 'Консорциум открытых проектов' },
      { name: 'OCI', desc: 'Стандарт контейнерных образов' }
    ],
    sentiment: 7
  }
];

const bySlug = new Map(ARTICLES.map((a) => [a.slug, a]));
const byId = new Map(ARTICLES.map((a) => [a.id, a]));

export function getArticleBySlug(slug: string): NewsArticle | undefined {
  return bySlug.get(slug);
}

export function getArticleById(id: string): NewsArticle | undefined {
  return byId.get(id);
}

const relatedBySlug: Record<string, { slug: string; title: string; cover_url: string }[]> = {
  'openclaw-news-agent-frameworks': [
    {
      slug: 'intel-n100-lightweight-ai-servers',
      title: ARTICLES[1].title,
      cover_url: 'https://images.unsplash.com/photo-1591405351990-4726e331f141?q=80&w=600'
    },
    {
      slug: 'linux-foundation-open-ai-stacks',
      title: ARTICLES[2].title,
      cover_url: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?q=80&w=600'
    }
  ],
  'intel-n100-lightweight-ai-servers': [
    {
      slug: 'openclaw-news-agent-frameworks',
      title: ARTICLES[0].title,
      cover_url: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=600'
    },
    {
      slug: 'linux-foundation-open-ai-stacks',
      title: ARTICLES[2].title,
      cover_url: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?q=80&w=600'
    }
  ],
  'linux-foundation-open-ai-stacks': [
    {
      slug: 'openclaw-news-agent-frameworks',
      title: ARTICLES[0].title,
      cover_url: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=600'
    },
    {
      slug: 'intel-n100-lightweight-ai-servers',
      title: ARTICLES[1].title,
      cover_url: 'https://images.unsplash.com/photo-1591405351990-4726e331f141?q=80&w=600'
    }
  ]
};

export function getRelatedForSlug(slug: string) {
  return relatedBySlug[slug] ?? relatedBySlug['openclaw-news-agent-frameworks'];
}

const navBySlug: Record<string, { prev: { slug: string; title: string } | null; next: { slug: string; title: string } | null }> = {
  'openclaw-news-agent-frameworks': {
    prev: null,
    next: { slug: ARTICLES[1].slug, title: ARTICLES[1].title }
  },
  'intel-n100-lightweight-ai-servers': {
    prev: { slug: ARTICLES[0].slug, title: ARTICLES[0].title },
    next: { slug: ARTICLES[2].slug, title: ARTICLES[2].title }
  },
  'linux-foundation-open-ai-stacks': {
    prev: { slug: ARTICLES[1].slug, title: ARTICLES[1].title },
    next: null
  }
};

export function getNavForSlug(slug: string) {
  return navBySlug[slug] ?? navBySlug['openclaw-news-agent-frameworks'];
}
