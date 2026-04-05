import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ─── Configuration ───────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const postsDir = path.join(__dirname, '..', 'content', 'posts');

const MAX_ARTICLES_PER_RUN = 3; // Scale later
const FETCH_TIMEOUT_MS = 15000;
const RATE_LIMIT_DELAY_MS = 2000;

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'can', 'that', 'this', 'these',
  'those', 'it', 'its', 'not', 'no', 'so', 'if', 'as', 'about', 'up',
  'out', 'into', 'over', 'after', 'before', 'between', 'under', 'again',
  'then', 'than', 'too', 'very', 'just', 'also', 'any', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
  'only', 'own', 'same', 'while', 'when', 'where', 'how', 'what', 'which',
  'who', 'whom', 'why',
  // Russian stopwords (in case titles leak in)
  'в', 'на', 'и', 'или', 'но', 'а', 'по', 'для', 'из', 'от', 'до',
  'с', 'у', 'о', 'об', 'как', 'что', 'кто', 'это', 'его', 'её', 'их',
  'он', 'она', 'они', 'был', 'была', 'были', 'не', 'же', 'ли',
]);

const KNOWN_ENTITIES = {
  Google: /\bgoogle\b/gi, Alphabet: /\balphabet\b/gi, OpenAI: /\bopenai\b/gi,
  Microsoft: /\bmicrosoft\b/gi, Meta: /\bmeta\b/gi, Facebook: /\bfacebook\b/gi,
  Anthropic: /\banthropic\b/gi, Claude: /\bclaude\b/gi, Apple: /\bapple\b/gi,
  Amazon: /\bamazon\b|aws\b/gi, Tesla: /\btesla\b/gi, Nvidia: /\bnvidia\b/gi,
  AMD: /\bamd\b/gi, Intel: /\bintel\b/gi, Samsung: /\bsamsung\b/gi,
  DeepMind: /\bdeepmind\b/gi, HuggingFace: /\bhugging\s*face\b/gi,
  xAI: /\bxai\b/gi, SpaceX: /\bspacex\b/gi, Musk: /\bmusk\b/gi,
  TikTok: /\btiktok\b/gi, Twitter: /\btwitter\b|x\b/gi, Reddit: /\breddit\b/gi,
  GitHub: /\bgithub\b/gi, Copilot: /\bcopilot\b/gi, Gemini: /\bgemini\b/gi,
  Midjourney: /\bmidjourney\b/gi, StableDiffusion: /\bstable\s*diffusion\b/gi,
  Bitcoin: /\bbitcoin\b/gi, Ethereum: /\bethereum\b/gi, Coinbase: /\bcoinbase\b/gi,
  Neuralink: /\bneuralink\b/gi, BostonDynamics: /\bboston\s*dynamics\b/gi,
  OpenRouter: /\bopenrouter\b/gi, Perplexity: /\bperplexity\b/gi,
  xAI: /\bxai\b/gi, Grok: /\bgrok\b/gi, Mistral: /\bmistral\b/gi,
  MistralAI: /\bmistral\s*ai\b/gi,
};

// ── Source Config ──
// quality: 1–10 (higher = better, wins on conflict)
// type: 'html' = scrape page, 'rss' = parse XML feed
const SOURCES_CONFIG = [
  {
    id: 'theneuron', name: 'The Neuron', quality: 5, type: 'html',
    url: 'https://www.theneuron.ai/',
    linkPattern: /href="(https:\/\/www\.theneuron\.ai\/[^"]*ai-news[^"]*|https:\/\/www\.theneuron\.ai\/explainer[^"]*)"[^>]*>\s*([^<]{30,120})\s*<\/a>/gi,
  },
  {
    id: 'decrypt', name: 'Decrypt', quality: 7, type: 'html',
    url: 'https://decrypt.co/news/artificial-intelligence',
    linkPattern: /href="(https:\/\/decrypt\.co\/[^"]*)"[^>]*>\s*([^<]{30,150})\s*<\/a>/gi,
  },
  {
    id: 'techstartups', name: 'TechStartups', quality: 5, type: 'html',
    url: 'https://techstartups.com/category/latest-tech-news/',
    linkPattern: /href="(https:\/\/techstartups\.com\/[^"]*)"[^>]*>\s*([^<]{30,150})\s*<\/a>/gi,
  },
  {
    id: 'techcrunch', name: 'TechCrunch', quality: 9, type: 'rss',
    url: 'https://techcrunch.com/feed/',
  },
  {
    id: 'arstechnica', name: 'Ars Technica', quality: 8, type: 'rss',
    url: 'https://arstechnica.com/feed/',
  },
  {
    id: 'venturebeat', name: 'VentureBeat', quality: 7, type: 'rss',
    url: 'https://venturebeat.com/feed/',
  },
  {
    id: '9to5google', name: '9to5Google', quality: 6, type: 'rss',
    url: 'https://9to5google.com/feed/',
  },
];

// ─── Tag Map (covers all MASTER_PLAN.md categories) ──────────────────────

const TAG_MAP = [
  // AI / ML
  { tag: 'AI', re: /\bai\b|\bartificial\s+intelligence\b/gi, category: 'AI/ML' },
  { tag: 'Machine-Learning', re: /\bmachine\s+learning\b|\bml\b|\bdeep\s+learning\b|\bneural\s+network/gi, category: 'AI/ML' },
  { tag: 'NLP', re: /\bnlp\b|\bnatural\s+language\b|\bllm\b|\btransformer\b|\bchatbot\b/gi, category: 'AI/ML' },
  { tag: 'AI-Agents', re: /\bai\s*agent|autonomous.*ai|agentic\b/gi, category: 'AI/ML' },
  { tag: 'Generative-AI', re: /\bgenerative\s*ai\b|generative\s+model|text.to.image|diffusion\b/gi, category: 'AI/ML' },
  // Hardware
  { tag: 'Hardware', re: /\bchip|gpu|tpu|hardware|processor|silicon|cpu|semiconductor\b/gi, category: 'Hardware' },
  { tag: 'Semiconductors', re: /\bsemiconductor|foundry|fab|tsmc|intel|amd|nvidia|asml\b/gi, category: 'Hardware' },
  // Software / Dev
  { tag: 'Software', re: /\bsoftware|framework|sdk|api|open.source|developer\b/gi, category: 'Software' },
  { tag: 'Programming', re: /\bpython\b|\brust\b|\btypescript\b|\bcode\b|\bprogramming\b|\bcoding\b/gi, category: 'Software' },
  // Gaming
  { tag: 'Gaming', re: /\bgaming\b|\bvideo\s*game|nintendo|playstation|xbox|gamer|esport\b/gi, category: 'Gaming' },
  // Robotics
  { tag: 'Robotics', re: /\brobot|humanoid|boston\s*dynamics|robotics|autonomous\s+vehicle|robotaxi\b/gi, category: 'Robotics' },
  { tag: 'Drones', re: /\bdrone|uav\b/gi, category: 'Robotics' },
  // Gadgets
  { tag: 'Gadgets', re: /\bsmartphone|iphone|android|tablet|wearable|smartwatch|samsung|ipad|ipod|macbook|laptop\b/gi, category: 'Gadgets' },
  // Space
  { tag: 'Space', re: /\bspace|spacex|starship|nasa|mars|moon|satellite|launch\b/gi, category: 'Space' },
  // Cybersecurity
  { tag: 'Cybersecurity', re: /\bcyber|hacker|breach|ransomware|security|exploit|vulnerability|malware|phishing\b/gi, category: 'Cybersecurity' },
  { tag: 'Privacy', re: /\bprivacy|censorship|surveillance|data\s*protection\b/gi, category: 'Cybersecurity' },
  // Cloud
  { tag: 'Cloud', re: /\bcloud\b|\baws\b|\bazure\b|\bgcp\b|serverless|kubernetes|docker\b/gi, category: 'Cloud' },
  // Startups
  { tag: 'Startups', re: /\bstartup\b|seed\s+round|series\s+[a-f]|funding|accelerator|unicorn|ipo|y\s*combinator|vc|venture\s+capital|incubator\b/gi, category: 'Startups' },
  { tag: 'Big-Tech', re: /\bgoogle\b|\bmeta\b|\bmicrosoft\b|\bamazon\b|\bapple\b|\bopenai\b|\banthropic\b|\bios\b/gi, category: 'Startups' },
  // Crypto
  { tag: 'Crypto', re: /\bcrypto|bitcoin|ethereum|blockchain|defi|nft|web3|stablecoin\b/gi, category: 'Crypto' },
  { tag: 'Fintech', re: /\bfintech|coinbase|stripe|payment|digital\s+wallet\b/gi, category: 'Crypto' },
  // Policy
  { tag: 'Policy', re: /\bregulation|policy|law|europe|eu\s+act|ai\s+act|antitrust|eu\b|china\s+law|ban|commission\b/gi, category: 'Policy' },
  // Automotive / EV
  { tag: 'Automotive', re: /\bev|electric\s+vehicle|tesla|lucid|rivian|hyundai\s+motor|ford\s+motor|gm\s+|general\s+motors|autonomous\s+driv|self.driv|waymo|cruise\b/gi, category: 'Automotive' },
  // Biotech / Health
  { tag: 'Biotech', re: /\bbiotech|drug\s+discovery|clinical\s+trial|pharmaceutical|genomics|precision\s+medicine\b/gi, category: 'Biotech' },
  // Energy
  { tag: 'Energy', re: /\bsolar\s+power|wind\s+energy|battery\s+tech|fusion\s+energy|renewable\s+energy|grid\b|nuclear\s+fus/gi, category: 'Energy' },
  // Social Media
  { tag: 'Social', re: /\bsocial\s+media|tiktok|x\.com|threads\s+app|instagram\b|snapchat|reddit\b/gi, category: 'Social' },
];

// ─── Utilities ────────────────────────────────────────────────────────────

function httpFetch(url, timeoutMs = FETCH_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xml,text/xml,application/rss+xml,*/*',
    };
    const req = lib.get(url, { headers, timeout: timeoutMs }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect (once)
        httpFetch(res.headers.location, timeoutMs).then(resolve).catch(() =>
          resolve({ status: res.statusCode, body: '', error: 'redirect-failed' })
        );
        return;
      }
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', (e) => resolve({ status: 0, body: '', error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '', error: 'timeout' }); });
  });
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8217;|&#39;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8220;/g, '"')
    .replace(/&#8212;/g, '—')
    .replace(/&#8211;/g, '–')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // Generic numeric entity decoder (&#NNNN;)
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .trim();
}

function extractMetaTag(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]*${property}=["'][^"']*["'][^>]*/?>`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*${property}=["']`, 'i'),
  ];
  for (const pat of patterns) {
    const match = html.match(pat);
    if (match) {
      const content = match[0].match(/content=["']([^"']*)["']/i);
      if (content) return content[1];
    }
  }
  return '';
}

function extractImage(html) {
  return (
    extractMetaTag(html, 'og:image') ||
    extractMetaTag(html, 'twitter:image') ||
    extractMetaTag(html, 'image') ||
    ''
  );
}

function extractDescription(html) {
  return extractMetaTag(html, 'description') || '';
}

// ─── RSS Parser (built-in, no deps) ──────────────────────────────────────

function parseRSS(xml) {
  const articles = [];
  // Extract <item> blocks
  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const block = itemMatch[0];

    const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    const descMatch = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
    const dateMatch = block.match(/<(?:pubDate|dc:date)[^>]*>([\s\S]*?)<\/(?:pubDate|dc:date)>/i);
    // Handle CDATA in description
    let description = descMatch ? descMatch[1].trim() : '';
    description = description.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');

    const title = titleMatch ? titleMatch[1].trim() : '';
    const link = linkMatch ? linkMatch[1].trim() : '';

    if (title && link) {
      articles.push({
        title: stripHtml(title),
        url: link.trim(),
        source: null, // set by caller
        sourceId: null,
        description: stripHtml(description).substring(0, 500),
        pubDate: dateMatch ? dateMatch[1].trim() : '',
      });
    }
  }

  // Also try <entry> (Atom)
  if (articles.length === 0) {
    const entryRegex = /<entry[\s\S]*?<\/entry>/gi;
    while ((itemMatch = entryRegex.exec(xml)) !== null) {
      const block = itemMatch[0];
      const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      // Atom link is <link href="..."/>
      const linkMatch = block.match(/<link[^>]*href=["']([^"']*)["']/i);
      // Or <link>...</link>
      const linkTextMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      const summaryMatch = block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
      const dateMatch = block.match(/<(?:updated|published|published)[^>]*>([\s\S]*?)<\/(?:updated|published|published)>/i);
      const contentMatch = block.match(/<content[^>]*>([\s\S]*?)<\/content>/i);

      const title = titleMatch ? titleMatch[1].trim() : '';
      const link = linkMatch ? linkMatch[1].trim() : (linkTextMatch ? linkTextMatch[1].trim() : '');
      const description = (summaryMatch ? summaryMatch[1] : (contentMatch ? contentMatch[1] : '')).trim()
        .replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');

      if (title && link) {
        articles.push({
          title: stripHtml(title),
          url: link.trim(),
          source: null, sourceId: null,
          description: stripHtml(description).substring(0, 500),
          pubDate: dateMatch ? dateMatch[1].trim() : '',
        });
      }
    }
  }
  return articles;
}

// ─── Scrapers ─────────────────────────────────────────────────────────────

async function scrapeHTML(src) {
  try {
    const res = await httpFetch(src.url);
    if (!res.body || res.status !== 200) {
      console.warn(`  ⚠ ${src.name}: HTTP ${res.status} ${res.error || ''}`);
      return [];
    }
    const articles = [];
    const pattern = src.linkPattern;
    pattern.lastIndex = 0; // reset
    let match;
    while ((match = pattern.exec(res.body)) !== null) {
      const title = match[2].trim();
      if (title.length > 30) {
        articles.push({ title, url: match[1], sourceId: src.id, source: src.name });
      }
    }
    // Unique by URL
    const seen = new Set();
    return articles.filter((a) => {
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });
  } catch (err) {
    console.error(`  ✖ ${src.name} HTML scrape error: ${err.message}`);
    return [];
  }
}

async function scrapeRSS(src) {
  try {
    const res = await httpFetch(src.url);
    if (!res.body || res.status !== 200) {
      console.warn(`  ⚠ ${src.name} RSS: HTTP ${res.status} ${res.error || ''}`);
      return [];
    }
    const articles = parseRSS(res.body);
    return articles.map((a) => ({ ...a, sourceId: src.id, source: src.name }));
  } catch (err) {
    console.error(`  ✖ ${src.name} RSS scrape error: ${err.message}`);
    return [];
  }
}

async function scrapeSource(src) {
  if (src.type === 'rss') return scrapeRSS(src);
  return scrapeHTML(src);
}

// ─── Fetch Full Article Content ──────────────────────────────────────────

/** Extract paragraphs from article body — robust across site templates */
function extractArticleText(html) {
  // Strategy: find article container, then extract <p> blocks from within
  const containerPatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    /<div[^>]*class="[^"]*(?:entry-content|post-content|article-body|story-body|article-body__inner)[^"]*"/gi,
    /<div[^>]*class="[^"]*(?:article|post-content|story-body|post-body)[^"]*"/gi,
  ];

  let articleHtml = 'FULL'; // fallback marker

  for (const pat of containerPatterns) {
    const m = pat.exec(html);
    if (m) {
      if (m[1]) {
        // Pattern with capture group (article tag)
        articleHtml = m[1];
        break;
      } else {
        // Pattern without capture — extract from match offset to reasonable end
        // Find the matching div and track nesting
        const startIdx = m.index;
        let depth = 0;
        let endIdx = startIdx;
        for (let i = startIdx; i < html.length && i < startIdx + 80000; i++) {
          if (html.substring(i, i + 5) === '<div ') depth++;
          if (html.substring(i, i + 6) === '</div>') { depth--; if (depth <= 0) { endIdx = i + 6; break; } }
        }
        articleHtml = html.substring(startIdx, endIdx);
        break;
      }
    }
  }

  // Extract paragraphs from the article container
  if (articleHtml === 'FULL') {
    // Fallback: strip everything but clean aggressively
    return stripHtml(html)
      .replace(/\b(skip to|main menu|navigation|footer|sidebar|cookie|subscribe|newsletter|popular|related\s+stories|trending|share this|comments)\b[^.]*/gi, '')
      .substring(0, 10000);
  }

  // Extract <p> tags and join
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  const paragraphs = [];
  let pm;
  while ((pm = pRegex.exec(articleHtml)) !== null) {
    const text = stripHtml(pm[1]);
    if (text.length > 30 && text.length < 2000) {
      paragraphs.push(text);
    }
    if (paragraphs.length >= 30) break; // cap
  }

  if (paragraphs.length === 0) {
    return stripHtml(articleHtml).substring(0, 10000);
  }

  return paragraphs.join('\n\n');
}

async function fetchArticleContent(article) {
  try {
    const res = await httpFetch(article.url);
    if (!res.body || res.status !== 200) return null;

    const text = extractArticleText(res.body);
    if (text.length < 300) return null;

    const coverImage = extractImage(res.body);
    const description = extractDescription(res.body);
    const articleTitle = extractMetaTag(res.body, 'og:title');

    return {
      text,
      fullHtml: res.body,
      coverImage,
      description,
      titleOverride: articleTitle || article.title,
    };
  } catch (err) {
    console.warn(`  ⚠ Failed to fetch content for "${article.title.substring(0, 60)}": ${err.message}`);
    return null;
  }
}

// ─── Deduplication System (3-level) ──────────────────────────────────────

function tokenize(text) {
  const lowered = text.toLowerCase();
  const cleaned = lowered.replace(/[^\wа-яё\s-]/gi, '');
  return cleaned.split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w) && !STOPWORDS.has(w.toLowerCase()));
}

function jaccardSimilarity(a, b) {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 && setB.size === 0) return 1.0;
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

function extractEntities(text) {
  const found = new Set();
  for (const [entity, re] of Object.entries(KNOWN_ENTITIES)) {
    if (re.test(text)) found.add(entity);
  }
  return [...found];
}

function parseDateForDedup(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr);
  } catch { return null; }
}

/**
 * Level 1: Exact URL match against existing published posts
 */
function isUrlDuplicate(url, existingUrls) {
  return existingUrls.has(url);
}

/**
 * Level 2: Fuzzy title match via Jaccard + same entity within 24h
 */
function isFuzzyDuplicate(title, dateStr, newArticle, existingPosts) {
  const newTokens = tokenize(title);
  const newEntities = extractEntities(title);
  const newDate = parseDateForDedup(dateStr);

  for (const post of existingPosts) {
    // Jaccard on titles
    const sim = jaccardSimilarity(title, post.title);
    if (sim >= 0.6) return true;

    // Same key entity + same date ±24h
    const postEntities = extractEntities(post.title);
    const sharedEntities = newEntities.filter((e) => postEntities.includes(e));
    if (sharedEntities.length > 0 && newDate) {
      const postDate = parseDateForDedup(post.date);
      if (postDate) {
        const diffHrs = Math.abs(newDate.getTime() - postDate.getTime()) / 36e5;
        if (diffHrs <= 24) return true;
      }
    }
  }
  return false;
}

/**
 * Level 3: Multi-source conflict resolution — keep highest quality
 * Returns articles to publish, filtering out lower-quality duplicates.
 */
function resolveMultiSourceConflicts(articles, existingPosts) {
  // Group by shared topic: entity overlap + date proximity
  const groups = [];

  for (const article of articles) {
    const articleEntities = extractEntities(article.title);
    const articleDate = parseDateForDedup(article.date);

    let placed = false;
    for (const group of groups) {
      const groupDate = parseDateForDedup(group[0].date);
      const groupEntities = extractEntities(group[0].title);
      const shared = articleEntities.filter((e) => groupEntities.includes(e));

      if (shared.length > 0) {
        // Check Jaccard similarity with group representative
        for (const gArticle of group) {
          const sim = jaccardSimilarity(article.title, gArticle.title);
          if (sim >= 0.4) {
            group.push(article);
            placed = true;
            break;
          }
        }
      }
    }

    if (!placed) groups.push([article]);
  }

  // For groups with multiple articles, keep only the highest quality
  const result = [];
  for (const group of groups) {
    // Sort by quality desc
    group.sort((a, b) => (b.quality || 0) - (a.quality || 0));

    // Also check Level 2 against existing posts for the winner
    const winner = group[0];
    if (isFuzzyDuplicate(winner.title, winner.date, winner, existingPosts)) continue;

    result.push(winner);
  }
  return result;
}

// --- Build existing posts index ---
function loadExistingPosts() {
  const files = fs.existsSync(postsDir) ? fs.readdirSync(postsDir) : [];
  const urls = new Set();
  const posts = [];

  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    try {
      const content = fs.readFileSync(path.join(postsDir, file), 'utf8');
      const srcMatch = content.match(/source: "([^"]+)"/);
      const titleMatch = content.match(/title: "([^"]+)"/);
      const dateMatch = content.match(/date: "([^"]+)"/);

      if (srcMatch) urls.add(srcMatch[1]);
      if (titleMatch) {
        posts.push({
          title: titleMatch[1],
          date: dateMatch ? dateMatch[1] : '1970-01-01',
          source: srcMatch ? srcMatch[1] : '',
        });
      }
    } catch { /* skip malformed */ }
  }
  return { urls, posts };
}

/**
 * Deduplicate candidate articles against existing posts AND within this batch
 * @param {Array} candidates — new articles with {title, url, sourceId, source, date, quality}
 * @returns {Array} deduplicated and conflict-resolved articles
 */
function deduplicate(candidates, existing) {
  const { urls, posts } = existing;

  // Level 1: URL
  let filtered = candidates.filter((a) => !isUrlDuplicate(a.url, urls));
  if (filtered.length === 0) {
    console.log('  All candidates are URL duplicates.');
    return [];
  }

  // Level 3 first (within this batch), then Level 2 against existing posts
  const resolved = resolveMultiSourceConflicts(filtered, posts);

  return resolved;
}

// ─── Content Rewrite Engine ───────────────────────────────────────────────

function generateSmartSlug(title, date) {
  const keyWords = tokenize(title);
  // Pick up to 6 meaningful words
  const selected = [];
  for (const w of keyWords) {
    if (w.length >= 3 && selected.length < 6) selected.push(w);
  }
  let slug = selected.join('-').replace(/-+/g, '-');
  // Truncate to fit 62 chars + date suffix (YYYYMMDD = 8) + hyphen
  if (slug.length > 62) {
    const words = slug.split('-');
    let truncated = '';
    for (const w of words) {
      if (truncated.length + w.length + 1 > 62) break;
      truncated += (truncated ? '-' : '') + w;
    }
    slug = truncated;
  }
  const dateSuffix = date.replace(/-/g, '').substring(0, 8);
  return slug + '-' + dateSuffix;
}

function smartTags(title, description, textSample) {
  // Use title + description + first 500 chars of cleaned text
  const combined = `${title} ${description || ''} ${(textSample || '').substring(0, 500)}`;
  const matched = [];

  for (const { tag, re } of TAG_MAP) {
    if (re.test(combined) && !matched.includes(tag)) {
      matched.push(tag);
    }
  }

  // Minimum 2 tags, max 5
  if (matched.length === 0) return ['Tech'];
  return matched.slice(0, 5);
}

function generateArticleContent(article) {
  const { title, text: rawText, url, coverImage, date, description, youtubeId } = article;
  const text = rawText || '';

  // --- Extract meaningful sentences ---
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15 && s.length < 600);

  // --- Build content blocks ---
  function trimToWords(text, targetWords) {
    const words = text.split(/\s+/);
    if (words.length <= targetWords) return text;
    return words.slice(0, targetWords).join(' ') + '.';
  }

  const leadSentences = sentences.slice(0, 5).join(' ');
  const detailSentences = sentences.slice(5, 12).join(' ');
  const contextSentences = sentences.slice(12, 18).join(' ');
  const implicationSentences = sentences.slice(18, 24).join(' ');

  const leadSummary = trimToWords(`${title}. ${leadSentences}`, 100 + Math.floor(Math.random() * 50));

  // --- Build sections ---
  const sections = [];

  // Section 1: The Lead
  if (leadSentences) {
    sections.push(`## The Lead\n\n${leadSummary}\n`);
  }

  // Section 2: Key Details
  if (detailSentences) {
    sections.push(`## Key Details\n\n${trimToWords(detailSentences, 80)}\n`);
  } else if (description) {
    sections.push(`## Key Details\n\n${description}\n`);
  }

  // YouTube placeholder marker — will go in the middle
  if (youtubeId) {
    sections.push(`{{YOUTUBE:${youtubeId}}}\n`);
  }

  // Section 3: Context
  if (contextSentences) {
    sections.push(`## Context\n\n${trimToWords(contextSentences, 80)}\n`);
  }

  // Section 4: What's Next
  if (implicationSentences) {
    sections.push(`## What's Next\n\n${trimToWords(implicationSentences, 80)}\n`);
  }

  // If we don't have enough structured content, fall back to first N paragraphs
  if (sections.length < 2) {
    const paragraphs = sentences.reduce((acc, s, i) => {
      const idx = Math.floor(i / 3);
      if (!acc[idx]) acc[idx] = [];
      acc[idx].push(s);
      return acc;
    }, []);

    const fallbackHeadings = ['The Lead', 'Key Details', 'Context', "What's Next"];
    for (let i = 0; i < Math.min(paragraphs.length, 4); i++) {
      const heading = fallbackHeadings[i] || 'Details';
      sections.push(`## ${heading}\n\n${paragraphs[i].join('. ')}.\n`);
    }
  }

  // --- Extract ---
  const excerpt = trimToWords(`${leadSentences}`, 150);

  // --- Tags ---
  const tags = smartTags(title, description || '', rawText);

  // --- Slug ---
  const slug = generateSmartSlug(title, date);

  // --- Opinion section ---
  const opinionTemplates = [
    "Technology evolves fast — staying informed is the best competitive advantage.",
    "In a sea of daily tech news, what matters is separating signal from noise.",
    "SiliconFeed keeps you ahead of the curve, tracking the shifts that shape your industry.",
    "The tech landscape moves quickly. What was cutting-edge yesterday is baseline today.",
    "Every headline tells a bigger story. We connect the dots so you don't have to.",
  ];
  const opinion = opinionTemplates[Math.floor(Math.random() * opinionTemplates.length)];

  const tagsList = tags.map((t) => `"${t}"`).join(', ');

  // Build final content
  const content = `---
title: "${title.replace(/"/g, '\\"').substring(0, 150)}"
date: "${date}"
excerpt: "${excerpt.replace(/"/g, "'").substring(0, 300)}"
tags: [${tagsList}]
source: "${url}"
author: "SiliconFeed Editorial Team"
---

${sections.join('\n')}

## Opinion 📡

_${opinion}_

`;

  return { slug, content, tags, excerpt, youtubeId: youtubeId || '' };
}

// Pre-Publish Validation — blocks bad articles before they hit disk
function validateArticle(content) {
  // 1. No HTML entities
  if (/&#\d{3,5};/.test(content)) return 'HTML entity found';

  // 2. Frontmatter must exist
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return 'Missing frontmatter';
  const fm = fmMatch[1];

  // 3. Tags — no garbage single words
  const tagsMatch = fm.match(/^tags:\s*\[([^\]]+)\]/m);
  if (tagsMatch) {
    const rawTags = tagsMatch[1].replace(/["']/g, '').split(',').map(t => t.trim());
    for (const t of rawTags) {
      if (/^BEST$/i.test(t)) return 'Bad tag: ' + t;
      if (/^TECH$/i.test(t)) return 'Bad tag: ' + t;
      if (/^[A-Z]{3,5}$/.test(t) && !['IPO', 'API', 'GPU', 'CPU', 'CEO', 'CTO', 'EVs', 'SRE', 'ML', 'AI'].includes(t.toUpperCase())) return 'Bad tag: ' + t;
    }
  }

  // 4. At least 2 H2 sections
  if ((content.match(/^## /gm) || []).length < 2) return 'Too few sections';

  // 5. No corrupted unicode in headers
  const badHeader = content.match(/^## [^\n]*\ufffd[^\n]*/m);
  if (badHeader) return 'Corrupted header';

  // 6. Body text > 200 chars
  const body = content.substring(fmMatch.index + fmMatch[0].length).replace(/[#\n_\-]/g, '').trim();
  if (body.length < 200) return 'Body too short: ' + body.length + ' chars';

  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== SiliconFeed Auto-Publish Pipeline ===');
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toLocaleTimeString('ru-RU', { timeZone: 'Europe/Kiev' });
  console.log(`Date: ${date} | Time: ${time}`);

  // Ensure posts directory
  if (!fs.existsSync(postsDir)) {
    fs.mkdirSync(postsDir, { recursive: true });
    console.log('Created posts directory:', postsDir);
  }

  // Load existing posts
  const existing = loadExistingPosts();
  console.log(`Existing posts indexed: ${existing.posts.length} (URLs: ${existing.urls.size})`);

  // Scrape all sources (fail independently)
  console.log(`\n📡 Scraping ${SOURCES_CONFIG.length} sources...`);
  const scrapePromises = SOURCES_CONFIG.map(async (src) => {
    try {
      const articles = await scrapeSource(src);
      console.log(`  ✅ ${src.name} (${src.type}): ${articles.length} articles`);
      return articles.map((a) => ({
        ...a,
        date: date,
        quality: src.quality,
      }));
    } catch (err) {
      console.error(`  ✖ ${src.name} failed: ${err.message}`);
      return [];
    }
  });

  const scrapeResults = await Promise.all(scrapePromises);
  let allCandidates = scrapeResults.flat();
  console.log(`\n📋 Total raw candidates: ${allCandidates.length}`);

  if (allCandidates === 0) {
    console.log('No articles found. Exiting.');
    return;
  }

  // Deduplication
  console.log('\n🔄 Deduplication (Level 1: URL, Level 2: Fuzzy, Level 3: Quality)...');
  const deduped = deduplicate(allCandidates, existing);
  console.log(`After deduplication: ${deduped.length} unique articles`);

  if (deduped.length === 0) {
    console.log('No new unique articles to publish.');
    return;
  }

  // Sort by quality (highest first), then take top MAX_ARTICLES_PER_RUN
  deduped.sort((a, b) => (b.quality || 0) - (a.quality || 0));
  const selected = deduped.slice(0, MAX_ARTICLES_PER_RUN);
  console.log(`Selected ${selected.length} articles for this run (max: ${MAX_ARTICLES_PER_RUN})\n`);

  // Fetch and publish
  let published = 0;
  for (const article of selected) {
    const sourceLabel = `[${article.source || article.sourceId}] Q${article.quality || 0}`;
    console.log(`\n📝 Fetching: "${article.title.substring(0, 90)}" ${sourceLabel}`);

    const content = await fetchArticleContent(article);
    if (!content || content.text.length < 300) {
      console.warn(`  ⚠ Not enough content (${content ? content.text.length : 0} chars), skipping.`);
      continue;
    }

    const articleData = {
      title: content.titleOverride || article.title,
      text: content.text,
      url: article.url,
      coverImage: content.coverImage,
      date: date,
      source: content.description,
      description: content.description,
    };

    const result = generateArticleContent(articleData);

    // VALIDATE before writing
    const validationError = validateArticle(result.content);
    if (validationError) {
      console.log(`  ❌ Validation failed: ${result.slug} — ${validationError}`);
      continue;
    }

    // Ensure unique filename
    let filename = result.slug + '.md';
    let filepath = path.join(postsDir, filename);
    let counter = 1;
    while (fs.existsSync(filepath)) {
      filename = result.slug + `-${counter}.md`;
      filepath = path.join(postsDir, filename);
      counter++;
    }

    fs.writeFileSync(filepath, result.content, 'utf8');
    console.log(`  ✅ Published: ${filename} (${result.tags.join(', ')})`);
    published++;

    // Rate limit
    await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));
  }

  console.log(`\n📦 Total published this run: ${published}/${MAX_ARTICLES_PER_RUN}`);
  console.log('=== Pipeline Complete ===\n');
}

main().catch((err) => {
  console.error('💥 Pipeline fatal error:', err.message);
  process.exit(1);
});
