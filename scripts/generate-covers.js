/**
 * Generate cover images for all posts.
 * Features:
 *   - Auto-fix SVG logos without fill (white-on-white issue)
 *   - Logo displayed at 80% of canvas width (960px / 1200px)
 *   - Smart tag-to-logo resolution (longest tag = most specific = wins)
 *   - Fallback to Brave image search, then text-based cover
 *   - Post-generation quality audit with auto-retry
 */
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

// Canvas dimensions
const W = 1200;
const H = 630;
// Logo at 80% of canvas width
const LOGO_W = 960;
const LOGO_H = 468;
const LOGO_X = (W - LOGO_W) / 2;  // 120, centered
const LOGO_Y = 81;

// ─── 1. Company logo map ───────────────────────────────────────────────────────
const companyLogos = {
  'openai': 'openai', 'anthropic': 'anthropic', 'google': 'google',
  'microsoft': 'microsoft', 'nvidia': 'nvidia', 'meta': 'meta',
  'amazon': 'amazon', 'bitcoin': 'bitcoin', 'oracle': 'oracle',
  'coinbase': 'coinbase', 'stripe': 'stripe', 'cloudflare': 'cloudflare',
  'spacex': 'spacex', 'freebsd': 'freebsd', 'algorand': 'algorand',
  'ethereum': 'ethereum', 'tesla': 'tesla', 'baidu': 'baidu',
  'wikipedia': 'wikipedia', 'brave': 'brave', 'duckduckgo': 'duckduckgo',
  'claude-code': 'claude-code',
};

// ─── 2. Product → Logo key map ─────────────────────────────────────────────────
const productToCompany = {
  'chatgpt': 'openai', 'gpt': 'openai', 'sora': 'openai', 'dall-e': 'openai',
  'dalle': 'openai', 'o1': 'openai', 'o3': 'openai',
  'claude': 'anthropic', 'claude code': 'claude-code', 'claude opus': 'anthropic',
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

// ─── Auto-fix SVG fill ────────────────────────────────────────────────────────
function fixSvgFillIfMissing(svgPath, color = '#1a1a1a') {
  const svg = fs.readFileSync(svgPath, 'utf8');
  const paths = svg.match(/<path[^>]*\/?>/g) || [];
  const needsFill = paths.some(p => !/fill\s*=/.test(p));
  // Skip if already has colors elsewhere
  if (!needsFill || /fill\s*=\s*["']#[0-9a-fA-F]/.test(svg) || /style\s*=\s*["'][^"']*fill\s*:/.test(svg)) return false;

  const fixed = svg.replace(
    /(<path\b)([^>]*?)(\/?>)/g,
    (m, open, attrs, close) => {
      if (/fill\s*=/.test(attrs)) return m;
      return `${open} fill="${color}"${attrs}${close}`;
    }
  );
  fs.writeFileSync(svgPath, fixed, 'utf8');
  return true;
}

// Auto-fix all SVGs on startup
{
  const svgs = fs.readdirSync(logosDir).filter(f => f.endsWith('.svg'));
  let fixed = 0;
  for (const f of svgs) { if (fixSvgFillIfMissing(path.join(logosDir, f))) fixed++; }
  if (fixed > 0) console.log(`[FIX] Added fill to ${fixed} SVG logo(s)\n`);
}

// ─── Resolve topic → logo key ──────────────────────────────────────────────────
function resolveLogoKey(tags) {
  const matches = [];
  for (const tag of tags) {
    const key = tag.toLowerCase();
    if (productToCompany[key]) matches.push({ key: productToCompany[key], score: key.length + 10 });
    if (companyLogos[key]) matches.push({ key: companyLogos[key], score: key.length + 5 });
  }
  for (const [company] of Object.entries(companyLogos)) {
    if (tags.some(t => t.toLowerCase().includes(company)))
      matches.push({ key: company, score: company.length });
  }
  for (const [product, co] of Object.entries(productToCompany)) {
    if (tags.some(t => t.toLowerCase().includes(product)))
      matches.push({ key: co, score: product.length });
  }
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.score - a.score);
  return { key: matches[0].key, type: 'company' };
}

// ─── Find logo file ────────────────────────────────────────────────────────────
function findLogoBuffer(key) {
  const svgP = path.join(logosDir, key + '.svg');
  if (fs.existsSync(svgP)) {
    fixSvgFillIfMissing(svgP);
    return { buffer: fs.readFileSync(svgP), isSvg: true };
  }
  for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
    const p = path.join(logosDir, key + ext);
    if (fs.existsSync(p)) return { buffer: fs.readFileSync(p), isSvg: false };
  }
  return null;
}

// ─── Build cover SVG with logo at 80% ──────────────────────────────────────────
function buildCoverSVG(imageBuffer, isSvg) {
  const mime = isSvg ? 'svg+xml' : 'png';
  const dataUri = `data:image/${mime};base64,${imageBuffer.toString('base64')}`;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="35%" stop-color="#8b5cf6"/>
      <stop offset="65%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="100"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect width="${W}" height="5" fill="url(#bar)"/>
  <!-- Background: blurred and scaled up -->
  <image href="${dataUri}" x="-800" y="-1400" width="2800" height="2800"
         opacity="0.2" filter="url(#blur)" preserveAspectRatio="xMidYMid meet"/>
  <!-- Logo: 80% width, centered -->
  <image href="${dataUri}" x="${LOGO_X}" y="${LOGO_Y}" width="${LOGO_W}" height="${LOGO_H}"
         opacity="1" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
}

// ─── Build custom cover from Brave image search ────────────────────────────────
function buildCustomCoverSVG(imageBuffer) {
  const dataUri = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="35%" stop-color="#8b5cf6"/>
      <stop offset="65%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="100"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect width="${W}" height="5" fill="url(#bar)"/>
  <image href="${dataUri}" x="-200" y="-300" width="1600" height="1230"
         opacity="0.15" filter="url(#blur)" preserveAspectRatio="xMidYMid slice"/>
</svg>`;
}

// ─── Fallback: text-based cover when image search fails ────────────────────────
function buildTextCoverSVG(title, tags) {
  const display = title.length > 80 ? title.substring(0, 77) + '\u2026' : title;
  const tag = (tags[0] || 'Tech').toUpperCase();
  const tagColors = {
    'AI': '#8b5cf6', 'STARTUPS': '#10b981', 'CLOUD': '#0ea5e9',
    'SECURITY': '#ef4444', 'CRYPTO': '#f59e0b', 'HARDWARE': '#6366f1',
    'POLICY': '#ec4899', 'REGULATION': '#f97316', 'GOVERNMENT': '#06b6d4',
  };
  const tagColor = tagColors[tag] || '#6366f1';
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${tagColor}"/>
      <stop offset="50%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
    <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="20" cy="20" r="1.5" fill="#cbd5e1"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>
  <rect width="${W}" height="5" fill="url(#bar)"/>
  <rect x="120" y="100" width="140" height="32" rx="16" fill="${tagColor}" opacity="0.15"/>
  <text x="190" y="122" font-family="sans-serif" font-size="13" font-weight="700" fill="${tagColor}" text-anchor="middle">${escXml(tag)}</text>
  <text x="600" y="340" font-family="Georgia, serif" font-size="48" font-weight="900" fill="#1e293b" text-anchor="middle" letter-spacing="-0.5">${escXml(display)}</text>
</svg>`;
}

function escXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
          const img = sharp(buf).resize(maxW, maxH, { fit: 'inside', background: '#ffffff' })
            .flatten({ background: '#ffffff' })
            .jpeg({ quality: 85 });
          resolve(await img.toBuffer());
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function fetchImageForTopic(slug, tags) {
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
          return await downloadImage(props.url, 1200, 630);
        } catch {}
      }
    } catch {}
  }
  return null;
}

// ─── Parse posts ───────────────────────────────────────────────────────────────
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

// ─── Post-render quality check ────────────────────────────────────────────────
async function qualityCheck(coverPath) {
  try {
    const meta = await sharp(coverPath).metadata();
    if (!meta.width || meta.width < 800) return `too small (${meta.width}x${meta.height})`;
    const center = await sharp(coverPath)
      .extract({
        left: Math.floor(W * 0.2),
        top: Math.floor(H * 0.2),
        width: Math.floor(W * 0.6),
        height: Math.floor(H * 0.5),
      })
      .resize(50, 50)
      .raw()
      .toBuffer();
    let sum = 0;
    for (let i = 0; i < center.length; i += 3) sum += (center[i] + center[i+1] + center[i+2]) / 3;
    const avg = sum / (center.length / 3);
    const mean = avg;
    let variance = 0;
    for (let i = 0; i < center.length; i += 3) {
      const px = (center[i] + center[i+1] + center[i+2]) / 3;
      variance += Math.pow(px - mean, 2);
    }
    variance = variance / (center.length / 3);
    if (avg > 252 && variance < 30) return `blank/white (avg:${avg.toFixed(0)},var:${variance.toFixed(0)})`;
    if (avg < 5 && variance < 30) return 'blank/black';
    return null; // OK
  } catch (e) {
    return 'check error: ' + e.message.substring(0, 60);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────
const posts = getAllPosts();
console.log(`Found ${posts.length} posts\n`);

(async () => {
  let done = 0;
  let skipped = 0;

  for (const post of posts) {
    const coverPath = path.join(coversDir, post.slug + '.jpg');
    const resolved = resolveLogoKey(post.tags);
    let logoBuffer, isSvg, source;

    if (resolved) {
      const logoResult = findLogoBuffer(resolved.key);
      if (!logoResult || !logoResult.buffer) {
        console.log(`  SKIP (no logo): ${post.slug} -> ${resolved.key}`);
        skipped++;
        continue;
      }
      logoBuffer = logoResult.buffer;
      isSvg = logoResult.isSvg;
      source = resolved.key;
    } else {
      console.log(`  SEARCH: ${post.slug}`);
      logoBuffer = await fetchImageForTopic(post.slug, post.tags);
      isSvg = false;
      source = logoBuffer ? 'custom-image' : 'text-fallback';
    }

    const svg = source === 'custom-image'
      ? buildCustomCoverSVG(logoBuffer)
      : source === 'text-fallback'
        ? buildTextCoverSVG(post.title, post.tags)
        : buildCoverSVG(logoBuffer, isSvg);

    try {
      const resvg = new Resvg(svg, { font: { loadSystemFonts: true } });
      const pngData = resvg.render().asPng();
      await sharp(pngData).jpeg({ quality: 90 }).toFile(coverPath);

      // Quality check — if blank, retry with text fallback
      const issue = await qualityCheck(coverPath);
      if (issue && source !== 'text-fallback') {
        console.log(`  RETRY (${issue}): ${post.slug}`);
        // Delete old file to avoid Windows file-lock issues
        try { fs.unlinkSync(coverPath); } catch {}
        const fallbackSvg = buildTextCoverSVG(post.title, post.tags);
        const fbPng = new Resvg(fallbackSvg, { font: { loadSystemFonts: true } }).render().asPng();
        await sharp(fbPng).jpeg({ quality: 90 }).toFile(coverPath);
        const retry = await qualityCheck(coverPath);
        if (retry) {
          console.log(`  FAIL: ${post.slug} — ${retry}`);
          continue;
        }
        console.log(`  DONE (fallback): ${post.slug} ✓`);
      } else if (issue) {
        console.log(`  WARN: ${post.slug} — ${issue}`);
      } else {
        console.log(`  DONE: ${post.slug} -> ${source} ✓`);
      }
      done++;
    } catch (e) {
      console.log(`  ERR: ${post.slug}: ${e.message.substring(0, 130)}`);
    }
  }

  console.log(`\nGenerated: ${done}/${posts.length}`);
  if (skipped > 0) console.log(`Skipped: ${skipped}`);
})().catch(e => console.error(e));
