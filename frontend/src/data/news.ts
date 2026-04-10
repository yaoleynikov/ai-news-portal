/**
 * Fallback articles for /news/[slug], RSS, and related links when DB is unavailable.
 */

export type NewsArticle = {
  slug: string;
  id: string;
  title: string;
  dek: string;
  excerpt: string;
  content_md: string;
  cover_url: string;
  /** From pipeline: company logo tile vs photoreal FLUX cover */
  cover_type?: 'company' | 'abstract';
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
    title: 'Openclaw launches autonomous frameworks for news agents',
    dek: 'No GPU or heavy infra: how agent pipelines move to cheap hardware and open APIs.',
    excerpt:
      'The new stack promises lower server load and lets AI agents find and rewrite news without GPU clusters...',
    content_md:
      '## Introduction\n\nThe new stack promises lower server load and lets AI agents find and rewrite news without GPU clusters. That can materially cut infrastructure spend.\n\n## N100 architecture\n\nRunning lean is possible with models that fit in RAM and skip discrete GPUs—ideal for zero-budget startups.',
    cover_url: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=1200',
    tags: ['AI', 'Openclaw', 'Automation'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source_url: 'https://techcrunch.com/2026/04/07/openclaw-framework/',
    faq: [
      { q: 'Why Openclaw?', a: 'To reduce load on agent news servers.' },
      { q: 'What hardware?', a: 'An efficient Intel N100 without a GPU is enough.' },
      { q: 'Is it free?', a: 'It targets free APIs; infra budget can be near zero.' }
    ],
    entities: [
      { name: 'Openclaw', desc: 'Agent orchestration framework' },
      { name: 'Intel', desc: 'Chipmaker (N100)' }
    ],
    sentiment: 8
  },
  {
    slug: 'intel-n100-lightweight-ai-servers',
    id: 'uuid-2',
    title: 'Intel N100 becomes the default for lightweight AI servers',
    dek: 'Microservers on N100 are popular with studios: low power and board price beat peak FPS.',
    excerpt:
      'Efficient N100 CPUs are suddenly popular with builders of autonomous microservices, enabling clusters on a shoestring...',
    content_md:
      '## Context\n\nIntel N100 parts were long aimed at thin clients and embedded gear. In 2026 they commonly back workers, queues, and light CPU LLM inference.\n\n## Practice\n\nA typical node is 8–16 GB RAM, no discrete GPU, Docker, and a minimal Linux. A four-node cluster often costs less than last-gen gaming GPU.',
    cover_url: 'https://images.unsplash.com/photo-1591405351990-4726e331f141?q=80&w=1200',
    tags: ['Hardware', 'Intel', 'Hosting'],
    created_at: new Date(Date.now() - 86400000).toISOString(),
    source_url: 'https://example.com/intel-n100-ai-hosting',
    faq: [
      { q: 'Is N100 enough for embeddings?', a: 'For small batches and offline jobs—yes; watch latency and RAM at scale.' },
      { q: 'Where to buy boards?', a: 'Mini PCs and N100 SBCs are sold by major marketplaces and OEMs.' }
    ],
    entities: [
      { name: 'Intel N100', desc: 'Efficient x86 SoC' },
      { name: 'Docker', desc: 'Container runtime' }
    ],
    sentiment: 6
  },
  {
    slug: 'linux-foundation-open-ai-stacks',
    id: 'uuid-3',
    title: 'Linux Foundation doubles down on open AI stacks',
    dek: 'Shared container profiles and reproducible builds: why enterprises care about open inference and who pays for compatibility.',
    excerpt:
      'The consortium publishes a compatibility roadmap for inference servers on open hardware and OCI containers...',
    content_md:
      '## Open by default\n\nVendors increasingly ship reference CPU-inference stacks without closed runtimes. Linux Foundation proposes shared OCI image specs and sample docker-compose for pilots.\n\n## What changes\n\nIntegrators can compare latency and TCO with identical entrypoints, pinned libraries, and reproducible benchmarks.',
    cover_url: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?q=80&w=1200',
    tags: ['Open Source', 'AI', 'Linux'],
    created_at: new Date(Date.now() - 172800000).toISOString(),
    source_url: 'https://example.com/linux-foundation-open-ai',
    faq: [
      { q: 'Linux only?', a: 'Focus is open stacks; OCI images run elsewhere too.' },
      { q: 'Where are specs?', a: 'Watch LF repos and working groups on AI infrastructure.' }
    ],
    entities: [
      { name: 'Linux Foundation', desc: 'Open-source consortium' },
      { name: 'OCI', desc: 'Container image standard' }
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
