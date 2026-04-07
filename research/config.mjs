// =============================================================================
// SiliconFeed Research — Site Configuration
// =============================================================================
// Tiered competitor list for Firecrawl analysis.
// Credit budget: 500 total
// =============================================================================

export const FIRECRAWL_API_KEY = "fc-1b04a890870a45ddad0156caa5694e57";

// Delay between API calls (ms) to respect rate limits
export const REQUEST_DELAY_MS = 2000;

// Scrape timeout per page (ms)
export const SCRAPE_TIMEOUT_MS = 45000;

// Maximum articles to fetch from map results per site
export const MAP_LIMIT = 100;

/**
 * Tier 1: Deep analysis — top IT/AI media
 * Budget: 1 map + 1 homepage + 18 articles = 20 credits × 10 = 200 credits
 */
export const TIER_1_SITES = [
  {
    id: "techcrunch",
    name: "TechCrunch",
    url: "https://techcrunch.com",
    articlePattern: /techcrunch\.com\/\d{4}\/\d{2}\/\d{2}\//,
    maxArticles: 18,
  },
  {
    id: "theverge",
    name: "The Verge",
    url: "https://www.theverge.com",
    articlePattern: /theverge\.com\/\d{4}\/\d+\/\d+\//,
    maxArticles: 18,
  },
  {
    id: "arstechnica",
    name: "Ars Technica",
    url: "https://arstechnica.com",
    articlePattern: /arstechnica\.com\/[a-z-]+\/\d{4}\/\d{2}\//,
    maxArticles: 18,
  },
  {
    id: "wired",
    name: "Wired",
    url: "https://www.wired.com",
    articlePattern: /wired\.com\/story\//,
    maxArticles: 18,
  },
  {
    id: "venturebeat",
    name: "VentureBeat",
    url: "https://venturebeat.com",
    articlePattern: /venturebeat\.com\/\d{4}\/\d{2}\/\d{2}\//,
    maxArticles: 18,
  },
  {
    id: "thenextweb",
    name: "The Next Web",
    url: "https://thenextweb.com",
    articlePattern: /thenextweb\.com\/[a-z-]+\//,
    maxArticles: 18,
  },
  {
    id: "9to5google",
    name: "9to5Google",
    url: "https://9to5google.com",
    articlePattern: /9to5google\.com\/\d{4}\/\d{2}\/\d{2}\//,
    maxArticles: 18,
  },
  {
    id: "tomshardware",
    name: "Tom's Hardware",
    url: "https://www.tomshardware.com",
    articlePattern: /tomshardware\.com\/[a-z-]+\/[a-z0-9-]+/,
    maxArticles: 18,
  },
  {
    id: "habr",
    name: "Habr",
    url: "https://habr.com",
    articlePattern: /habr\.com\/(ru|en)\/articles\/\d+/,
    maxArticles: 18,
  },
  {
    id: "3dnews",
    name: "3DNews",
    url: "https://3dnews.ru",
    articlePattern: /3dnews\.ru\/\d+/,
    maxArticles: 18,
  },
];

/**
 * Tier 2: Overview analysis — broader IT media landscape
 * Budget: 1 map + 1 homepage + 5 articles = 7 credits × 15 = 105 credits
 */
export const TIER_2_SITES = [
  {
    id: "engadget",
    name: "Engadget",
    url: "https://www.engadget.com",
    articlePattern: /engadget\.com\/[a-z0-9-]+-\d+\.html/,
    maxArticles: 5,
  },
  {
    id: "zdnet",
    name: "ZDNet",
    url: "https://www.zdnet.com",
    articlePattern: /zdnet\.com\/article\//,
    maxArticles: 5,
  },
  {
    id: "cnet",
    name: "CNET",
    url: "https://www.cnet.com",
    articlePattern: /cnet\.com\/tech\//,
    maxArticles: 5,
  },
  {
    id: "gizmodo",
    name: "Gizmodo",
    url: "https://gizmodo.com",
    articlePattern: /gizmodo\.com\/[a-z0-9-]+/,
    maxArticles: 5,
  },
  {
    id: "macrumors",
    name: "MacRumors",
    url: "https://www.macrumors.com",
    articlePattern: /macrumors\.com\/\d{4}\/\d{2}\/\d{2}\//,
    maxArticles: 5,
  },
  {
    id: "androidauthority",
    name: "Android Authority",
    url: "https://www.androidauthority.com",
    articlePattern: /androidauthority\.com\/[a-z0-9-]+-\d+\//,
    maxArticles: 5,
  },
  {
    id: "xda",
    name: "XDA Developers",
    url: "https://www.xda-developers.com",
    articlePattern: /xda-developers\.com\/[a-z0-9-]+\//,
    maxArticles: 5,
  },
  {
    id: "bleepingcomputer",
    name: "BleepingComputer",
    url: "https://www.bleepingcomputer.com",
    articlePattern: /bleepingcomputer\.com\/news\//,
    maxArticles: 5,
  },
  {
    id: "openai_blog",
    name: "OpenAI Blog",
    url: "https://openai.com/blog",
    articlePattern: /openai\.com\/(blog|index)\//,
    maxArticles: 5,
  },
  {
    id: "deepmind_blog",
    name: "DeepMind Blog",
    url: "https://deepmind.google",
    articlePattern: /deepmind\.google\/(research|discover)\//,
    maxArticles: 5,
  },
  {
    id: "huggingface_blog",
    name: "Hugging Face Blog",
    url: "https://huggingface.co/blog",
    articlePattern: /huggingface\.co\/blog\//,
    maxArticles: 5,
  },
  {
    id: "ixbt",
    name: "iXBT",
    url: "https://www.ixbt.com",
    articlePattern: /ixbt\.com\/news\/\d{4}\/\d{2}/,
    maxArticles: 5,
  },
  {
    id: "cnews",
    name: "CNews",
    url: "https://www.cnews.ru",
    articlePattern: /cnews\.ru\/news\//,
    maxArticles: 5,
  },
  {
    id: "overclockers",
    name: "Overclockers",
    url: "https://overclockers.ru",
    articlePattern: /overclockers\.ru\/blog\//,
    maxArticles: 5,
  },
  {
    id: "computerworld",
    name: "Computerworld",
    url: "https://www.computerworld.com",
    articlePattern: /computerworld\.com\/article\//,
    maxArticles: 5,
  },
];

/**
 * Tier 3: Niche AI media — direct competitors
 * Budget: 1 map + 1 homepage + 5 articles = 7 credits × 5 = 35 credits
 */
export const TIER_3_SITES = [
  {
    id: "the_decoder",
    name: "The Decoder",
    url: "https://the-decoder.com",
    articlePattern: /the-decoder\.com\/[a-z0-9-]+/,
    maxArticles: 5,
  },
  {
    id: "bensbites",
    name: "Ben's Bites",
    url: "https://bensbites.com",
    articlePattern: /bensbites\.com\//,
    maxArticles: 5,
  },
  {
    id: "therundown",
    name: "The Rundown AI",
    url: "https://www.therundown.ai",
    articlePattern: /therundown\.ai\//,
    maxArticles: 5,
  },
  {
    id: "aisnakeoil",
    name: "AI Snake Oil",
    url: "https://www.aisnakeoil.com",
    articlePattern: /aisnakeoil\.com\/p\//,
    maxArticles: 5,
  },
  {
    id: "simonwillison",
    name: "Simon Willison",
    url: "https://simonwillison.net",
    articlePattern: /simonwillison\.net\/\d{4}\//,
    maxArticles: 5,
  },
];

/**
 * Get all sites as a flat array with tier info
 */
export function getAllSites() {
  return [
    ...TIER_1_SITES.map((s) => ({ ...s, tier: 1 })),
    ...TIER_2_SITES.map((s) => ({ ...s, tier: 2 })),
    ...TIER_3_SITES.map((s) => ({ ...s, tier: 3 })),
  ];
}

/**
 * Estimate total credits needed
 */
export function estimateCredits() {
  const t1 = TIER_1_SITES.length * (1 + 1 + 18); // map + homepage + articles
  const t2 = TIER_2_SITES.length * (1 + 1 + 5);
  const t3 = TIER_3_SITES.length * (1 + 1 + 5);
  return { tier1: t1, tier2: t2, tier3: t3, total: t1 + t2 + t3 };
}
