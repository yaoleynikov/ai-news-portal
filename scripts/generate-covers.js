const fs = require('fs');
const path = require('path');
const https = require('https');
const { Resvg } = require('@resvg/resvg-js');
const sharp = require('sharp');

const rootDir = __dirname.endsWith('scripts') ? path.join(__dirname, '..') : process.cwd();
const postsDir = path.join(rootDir, 'content', 'posts');
const logosDir = path.join(rootDir, 'public', 'logos');
const coversDir = path.join(rootDir, 'public', 'covers');
const BRAVE_KEY = 'BSAuzT5f6qJnM1FNts_-LYkacF6yuKV';

// ─── 1. Company logo map ───────────────────────────────────────────────────────
const companyLogos = {
  'openai': 'openai', 'anthropic': 'anthropic', 'google': 'google',
  'microsoft': 'microsoft', 'nvidia': 'nvidia', 'meta': 'meta',
  'amazon': 'amazon', 'bitcoin': 'bitcoin', 'oracle': 'oracle',
  'coinbase': 'coinbase', 'stripe': 'stripe', 'cloudflare': 'cloudflare',
  'spacex': 'spacex', 'freebsd': 'freebsd', 'algorand': 'algorand',
  'ethereum': 'ethereum', 'tesla': 'tesla', 'baidu': 'baidu',
  'wikipedia': 'wikipedia', 'brave': 'brave', 'duckduckgo': 'duckduckgo',
};

// ─── 2. Product → Company map ──────────────────────────────────────────────────
const productToCompany = {
  'chatgpt': 'openai', 'gpt': 'openai', 'sora': 'openai', 'dall-e': 'openai',
  'dalle': 'openai', 'o1': 'openai', 'o3': 'openai',
  'claude': 'anthropic', 'claude code': 'anthropic', 'claude opus': 'anthropic',
  'claude sonnet': 'anthropic',
  'gemini': 'google', 'gemma': 'google', 'bard': 'google',
  'copilot': 'microsoft', 'github copilot': 'microsoft', 'azure': 'microsoft',
  'windows': 'microsoft', 'xbox': 'microsoft', 'bing': 'microsoft',
  'grok': 'xai', 'twitter': 'x', 'x': 'x',
  'stable diffusion': 'stability-ai', 'sdxl': 'stability-ai',
  'llama': 'meta', 'mistral': 'mistral',
  'cuda': 'nvidia', 'geforce': 'nvidia', 'rtx': 'nvidia',
  'aws': 'amazon', 'alexa': 'amazon', 'kindle': 'amazon',
  'bitcoin': 'bitcoin', 'eth': 'ethereum', 'solana': 'solana',
  'robotaxi': 'baidu', 'apollo': 'baidu',
  'freebsd': 'freebsd',
};

// ─── Resolve topic → logo key ──────────────────────────────────────────────────
function resolveLogoKey(tags) {
  // Collect all matches, score by specificity (longer tag = more specific)
  const matches = [];
  for (const tag of tags) {
    const key = tag.toLowerCase();
    // Exact product match
    if (productToCompany[key]) matches.push({ key: productToCompany[key], score: key.length + 10 });
    // Exact company match
    if (companyLogos[key]) matches.push({ key: companyLogos[key], score: key.length + 5 });
  }
  // Fuzzy: check all companies/products against all tags
  for (const [company] of Object.entries(companyLogos)) {
    if (tags.some(t => t.toLowerCase().includes(company)))
      matches.push({ key: company, score: company.length });
  }
  for (const [product, co] of Object.entries(productToCompany)) {
    if (tags.some(t => t.toLowerCase().includes(product)))
      matches.push({ key: co, score: product.length });
  }
  if (matches.length === 0) return null;
  // Highest score wins (longest/most specific match)
  matches.sort((a, b) => b.score - a.score);
  return { key: matches[0].key, type: 'company' };
}

// ─── Brave image search ────────────────────────────────────────────────────────
function braveSearchImages(query, count = 10) {
  return new Promise((resolve, reject) => {
    const url = new URL('https://api.search.brave.com/res/v1/images/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', count);
    https.get(url, {
      headers: { 'X-Subscription-Token': BRAVE_KEY, 'Accept': 'application/json' }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data).results || []); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function downloadImage(url, maxW = 800, maxH = 600) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if ([301,302,307,308].includes(res.statusCode) && res.headers.location) {
        return resolve(downloadImage(res.headers.location, maxW, maxH));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', async () => {
        try {
          const buf = Buffer.concat(chunks);
          // Process: resize, add white bg, ensure JPEG
          const img = sharp(buf).resize(maxW, maxH, { fit: 'inside', background: '#ffffff' })
            .flatten({ background: '#ffffff' })
            .jpeg({ quality: 85 });
          const processed = await img.toBuffer();
          resolve(processed);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function fetchImageForTopic(slug, tags) {
  // Build smart search query from slug
  const parts = slug.replace(/-/g, ' ')
    .replace(/\b(2026|2025|ai|new|latest)\b/gi, '')
    .replace(/\s+/g, ' ').trim();

  const queries = [
    `${parts} technology concept illustration`,
    `${tags.slice(0, 3).join(' ')} technology concept art`,
    `${parts} digital art`,
    `${tags[0]} technology background`,
  ];

  for (const q of queries) {
    try {
      const results = await braveSearchImages(q, 8);
      for (const img of results) {
        const props = img.properties;
        if (!props || !props.url || !props.url.startsWith('https')) continue;
        if (props.url.includes('brave.com') || props.url.includes('imgs.search.brave.com')) continue;
        const w = props.width || 0, h = props.height || 0;
        if (w < 400 || h < 300) continue;

        try {
          const buf = await downloadImage(props.url, 1200, 630);
          return buf;
        } catch {}
      }
    } catch {}
  }
  return null;
}

// ─── Cover generation ──────────────────────────────────────────────────────────
function findLogoBuffer(key) {
  for (const ext of ['.png', '.jpg', '.jpeg']) {
    const p = path.join(logosDir, key + ext);
    if (fs.existsSync(p)) return fs.readFileSync(p);
  }
  const svgP = path.join(logosDir, key + '.svg');
  if (fs.existsSync(svgP)) return fs.readFileSync(svgP);
  return null;
}

function buildCoverSVG(imageBuffer, isSvg) {
  const mime = isSvg ? 'svg+xml' : 'png';
  const dataUri = `data:image/${mime};base64,${imageBuffer.toString('base64')}`;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="50%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="80"/></filter>
  </defs>
  <rect width="1200" height="630" fill="#ffffff"/>
  <rect width="1200" height="6" fill="url(#bar)"/>
  <image href="${dataUri}" x="-1000" y="-1200" width="3200" height="3200"
         opacity="0.25" filter="url(#blur)" preserveAspectRatio="xMidYMid meet"/>
  <image href="${dataUri}" x="270" y="136" width="660" height="346"
         opacity="1" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
}

function buildCustomCoverSVG(imageBuffer) {
  // For searched images: use as blurred background, no clear logo on top
  const dataUri = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="50%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
  </defs>
  <!-- White base -->
  <rect width="1200" height="630" fill="#ffffff"/>
  <!-- Top accent bar -->
  <rect width="1200" height="6" fill="url(#bar)"/>
  <!-- Scaled to fill canvas, slightly blurred -->
  <image href="${dataUri}" x="-200" y="-300" width="1600" height="1230"
         opacity="0.15" preserveAspectRatio="xMidYMid slice"/>
</svg>`;
}

function getAllPosts() {
  const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
  return files.map(filename => {
    const raw = fs.readFileSync(path.join(postsDir, filename), 'utf-8').replace(/^\uFEFF/, '');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return null;
    const fm = match[1];
    const titleLine = fm.match(/title:\s*(.+)$/m);
    let title = 'Untitled';
    if (titleLine) title = titleLine[1].trim().replace(/^\s*["']/, '').replace(/["']\s*$/, '');
    const tagsMatch = fm.match(/^tags:\s*\[([^\]]+)\]/m);
    const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, '')) : ['Tech'];
    return { slug: filename.replace(/\.md$/, ''), title, tags };
  }).filter(Boolean);
}

// ─── Main ──────────────────────────────────────────────────────────────────────
const posts = getAllPosts();
console.log(`Found ${posts.length} posts`);

(async () => {
  let done = 0;
  for (const post of posts) {
    const coverPath = path.join(coversDir, post.slug + '.jpg');
    const resolved = resolveLogoKey(post.tags);
    let logoBuffer, isSvg, source;

    if (resolved) {
      // Use company logo
      logoBuffer = findLogoBuffer(resolved.key);
      if (!logoBuffer) {
        console.log(`  SKIP (no logo): ${post.slug} -> ${resolved.key}`);
        continue;
      }
      isSvg = resolved.key.endsWith('.svg');
      source = resolved.key;
    } else {
      // Search for relevant image via Brave
      console.log(`  SEARCH: ${post.slug} [${post.tags.join(', ')}]`);
      logoBuffer = await fetchImageForTopic(post.slug, post.tags);
      if (!logoBuffer) {
        console.log(`  SKIP (no image): ${post.slug}`);
        continue;
      }
      isSvg = false;
      source = 'custom-image';
    }

    try {
      const svg = source === 'custom-image'
        ? buildCustomCoverSVG(logoBuffer)
        : buildCoverSVG(logoBuffer, isSvg);

      const resvg = new Resvg(svg, { font: { loadSystemFonts: true } });
      const pngData = resvg.render().asPng();
      await sharp(pngData).jpeg({ quality: 90 }).toFile(coverPath);
      console.log(`  DONE: ${post.slug} -> ${source}`);
      done++;
    } catch (e) {
      console.log(`  ERR: ${post.slug}: ${e.message.substring(0, 130)}`);
    }
  }
  console.log(`\nGenerated ${done}/${posts.length} covers`);
})().catch(e => console.error(e));
