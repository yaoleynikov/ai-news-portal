/**
 * Generate cover images for all posts.
 * Features:
 *   - Auto-fix SVG logos without fill (white-on-white issue)
 *   - Render SVG at 4x, downscale for clean anti-aliased edges (no pixel noise)
 *   - Logo centered at ~50% of canvas width
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
// Logo: centered, 80% of canvas (bounding box); preserveAspectRatio="meet" ensures fit
const LOGO_W = Math.round(W * 0.8);  // 960
const LOGO_H = Math.round(H * 0.8);  // 504
const LOGO_X = (W - LOGO_W) / 2;     // 120
const LOGO_Y = (H - LOGO_H) / 2;     // 63

// Fill color for SVGs that lack it
const SVG_FILL = '#000000';

// в”Ђв”Ђв”Ђ 1. Company logo map в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
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

// в”Ђв”Ђв”Ђ 2. Product в†’ Logo key map в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
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

// в”Ђв”Ђв”Ђ Auto-fix SVG fill в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function fixSvgFillIfMissing(svgPath) {
  const svg = fs.readFileSync(svgPath, 'utf8');
  const paths = svg.match(/<path[^>]*\/?>/g) || [];
  const needsFill = paths.some(p => !/fill\s*=/.test(p));
  if (!needsFill || /fill\s*=\s*["']#[0-9a-fA-F]/.test(svg) || /style\s*=\s*["'][^"']*fill\s*:/.test(svg)) return false;

  const fixed = svg.replace(
    /(<path\b)([^>]*?)(\/?>)/g,
    (m, open, attrs, close) => {
      if (/fill\s*=/.test(attrs)) return m;
      return `${open} fill="${SVG_FILL}"${attrs}${close}`;
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

// в”Ђв”Ђв”Ђ Resolve topic в†’ logo key в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function resolveLogoKey(tags, slug) {
  const matches = [];

  // Clean slug: remove digit sequences (&#8217; → tesla8217s → tesla s)
  // and extract meaningful words for company matching
  const cleanSlug = slug
    .replace(/-/g, ' ')
    .replace(/([a-z])\d{2,}([a-z])/gi, '$1 $2') // tesla8217s → tesla s
    .replace(/\d+/g, '')  // remove all digits
    .replace(/[^a-z\s]/gi, ' ')  // remove any remaining special chars
    .split(/\s+/)
    .map(w => w.length > 2 && w.endsWith('s') ? [w.slice(0, -1), w] : w)
    .flat()
    .filter(w => w.length > 2);

  // 1. Match company/product names from slug words (highest score = most reliable)
  for (const word of cleanSlug) {
    const key = word.toLowerCase();
    if (companyLogos[key]) matches.push({ key, score: 100 + key.length });
    if (productToCompany[key]) matches.push({ key: productToCompany[key], score: 90 + key.length });
  }

  // 2. Match from tags
  for (const tag of tags) {
    const key = tag.toLowerCase();
    if (companyLogos[key]) matches.push({ key, score: 80 + key.length });
    if (productToCompany[key]) matches.push({ key: productToCompany[key], score: 70 + key.length });
  }

  // 3. Substring match: tag contains company name
  for (const [company] of Object.entries(companyLogos)) {
    if (tags.some(t => t.toLowerCase().includes(company)))
      matches.push({ key: company, score: company.length });
  }

  // 4. Substring match: tag contains product name
  for (const [product, co] of Object.entries(productToCompany)) {
    if (tags.some(t => t.toLowerCase().includes(product)))
      matches.push({ key: co, score: product.length });
  }

  if (matches.length === 0) return null;
  matches.sort((a, b) => b.score - a.score);
  return { key: matches[0].key, type: 'company' };
}

// в”Ђв”Ђв”Ђ Find logo file в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function findLogoPath(key) {
  const svgP = path.join(logosDir, key + '.svg');
  if (fs.existsSync(svgP)) { fixSvgFillIfMissing(svgP); return { path: svgP, isSvg: true }; }
  for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
    const p = path.join(logosDir, key + ext);
    if (fs.existsSync(p)) return { path: p, isSvg: false };
  }
  return null;
}

// в”Ђв”Ђв”Ђ Render logo to a clean PNG buffer (no alpha noise) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
async function renderLogoToPng(logoPath, isSvg, targetSize) {
  if (!isSvg) {
    // CRITICAL: flatten BEFORE resize to eliminate fake transparency
    // (checkerboard patterns that some PNG sites embed)
    return await sharp(logoPath)
      .flatten({ background: '#ffffff' })
      .resize(targetSize, targetSize, { fit: 'contain' })
      .png({ compressionLevel: 9 })
      .toBuffer();
  }
  // Render SVG at 4x, then apply binary alpha mask to eliminate gray edge noise
  const svgContent = fs.readFileSync(logoPath, 'utf8');
  const renderSize = targetSize * 4;
  const hiRes = new Resvg(svgContent, {
    font: { loadSystemFonts: false },
    fitTo: { mode: 'width', value: renderSize }
  }).render().asPng();

  // Step 1: downscale first (keeps semi-transparent edges)
  const downscaled = await sharp(hiRes)
    .resize(targetSize, targetSize, { fit: 'contain' })
    .raw()
    .toBuffer();
  const hiResMeta = await sharp(hiRes).metadata();
  const scale = targetSize / hiResMeta.width;
  const newW = targetSize;
  const newH = targetSize;

  // Step 2: binary threshold alpha вЂ” if alpha > 0, make it opaque (RGB = fill color)
  // This eliminates all semi-transparent gray fringe pixels
  const clean = Buffer.alloc(downscaled.length);
  const fill = 0; // black
  for (let i = 0; i < downscaled.length; i += 4) {
    if (downscaled[i + 3] > 0) {
      clean[i] = fill;
      clean[i + 1] = fill;
      clean[i + 2] = fill;
      clean[i + 3] = 255;
    } else {
      clean[i] = 255;     // white bg
      clean[i + 1] = 255;
      clean[i + 2] = 255;
      clean[i + 3] = 255;
    }
  }
  return sharp(clean, { raw: { width: newW, height: newH, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// в”Ђв”Ђв”Ђ Build cover with Sharp composite (avoids Resvg О± artifacts) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
async function buildCoverWithSharp(logoPngBuffer) {
  // Step 1: Create white background
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#ffffff"/></svg>`
  );
  // Step 2: Composite logo on top using sharp (proper alpha handling)
  return await sharp(bg)
    .composite([
      {
        input: logoPngBuffer,
        top: LOGO_Y,
        left: LOGO_X,
      },
    ])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

// в”Ђв”Ђв”Ђ Build custom cover from Brave image search в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function buildCustomCoverSVG(imageBuffer) {
  const dataUri = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="blur"><feGaussianBlur stdDeviation="100"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <image href="${dataUri}" x="-200" y="-300" width="1600" height="1230"
         opacity="0.15" filter="url(#blur)" preserveAspectRatio="xMidYMid slice"/>
</svg>`;
}

// ─── Watermark / stock-photo detector ──────────────────────────────────────
const STOCK_KEYWORDS = [
  'shutterstock', 'gettyimages', 'istockphoto', 'alamy', 'dreamstime',
  'depositphotos', '123rf', 'stock.adobe', 'pngtree', 'cleanpng',
  'pngguru', 'pngwing', 'pngtree', 'freepik',
];

/**
 * Quick checks for watermarked / low-quality stock images.
 * Returns true if the image should be REJECTED.
 */
async function isWatermarkedOrStock(buffer, url = '') {
  // 1) URL-level check
  const urlLower = url.toLowerCase();
  if (urlLower.includes('shutterstock') || urlLower.includes('gettyimages') ||
      urlLower.includes('istock') || urlLower.includes('alamy') ||
      urlLower.includes('dreamstime') || urlLower.includes('depositphotos') ||
      urlLower.includes('pngtree') || urlLower.includes('pngwing') ||
      urlLower.includes('pngguru') || urlLower.includes('cleanpng') ||
      urlLower.includes('watermark') || urlLower.includes('preview.')) {
    return true;
  }

  try {
    const meta = await sharp(buffer).metadata();
    const w = meta.width || 0, h = meta.height || 0;
    if (w < 400 || h < 300) return true; // too small = likely thumbnail

    // 2) Convert to 8-bit grayscale for analysis
    const raw = await sharp(buffer)
      .grayscale()
      .resize(64, 64, { fit: 'inside' })
      .raw()
      .toBuffer();

    // 3) Repeated-pattern (grid) detection — diagonal variance
    //    Watermarks form diagonal streaks; measure row-to-row and col-to-col diffs
    let rowVar = 0, colVar = 0;
    const s = 64;
    for (let y = 0; y < s - 1; y++) {
      for (let x = 0; x < s; x++) {
        rowVar += Math.abs(raw[y * s + x] - raw[(y + 1) * s + x]);
      }
    }
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s - 1; x++) {
        colVar += Math.abs(raw[y * s + x] - raw[y * s + (x + 1)]);
      }
    }
    const total = rowVar + colVar;
    const maxPossible = s * (s - 1) * 2 * 255;
    const uniformity = 1 - total / maxPossible;

    // High uniformity + mid-range avg → repeating grid/watermark pattern
    const avgPxl = raw.reduce((a, b) => a + b, 0) / raw.length;
    if (uniformity > 0.96 && avgPxl > 80 && avgPxl < 180) return true;

    // 4) Edge-to-content ratio — watermarked images have many tiny high-freq edges
    //    but low actual structure (edge strength / contrast ratio)
    let edgeSum = 0;
    for (let y = 1; y < s - 1; y++) {
      for (let x = 1; x < s - 1; x++) {
        const i = y * s + x;
        const gx = Math.abs(raw[i + 1] - raw[i - 1]);
        const gy = Math.abs(raw[i + s] - raw[i - s]);
        edgeSum += gx + gy;
      }
    }
    const edgeDensity = edgeSum / ((s - 2) * (s - 2) * 2 * 255);
    if (edgeDensity > 0.15 && uniformity > 0.94) return true;

    // 5) Check for stock keyword text by looking at color variance in small patches
    //    Watermark text creates localized high-contrast patches in otherwise uniform areas
    //    (already covered by uniformity check, but additional check on full-res)
  } catch {
    return true; // can't analyze → reject
  }

  return false;
}

// в”Ђв”Ђв”Ђ Fallback: text-based cover when image search fails в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function buildTextCoverSVG(title, tags) {
  const tag = (tags[0] || 'Tech').toUpperCase();
  const tagColors = {
    'AI': '#8b5cf6', 'STARTUPS': '#10b981', 'CLOUD': '#0ea5e9',
    'SECURITY': '#ef4444', 'CRYPTO': '#f59e0b', 'HARDWARE': '#6366f1',
    'POLICY': '#ec4899', 'REGULATION': '#f97316', 'GOVERNMENT': '#06b6d4',
    'ROBOTICS': '#f472b6', 'GAMING': '#22d3ee', 'GADGETS': '#a78bfa',
    'AUTOMOTIVE': '#34d399', 'BIOTECH': '#fb7185', 'ENERGY': '#fbbf24',
  };
  const tagColor = tagColors[tag] || '#6366f1';

  // Compute a subtle background gradient from tag color
  const bgLight = hexToRGBA(tagColor, 0.04);
  const bgMid = hexToRGBA(tagColor, 0.08);

  // Capitalize tag for display
  const displayTag = tag.split('-').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

  // Clean title for display (truncate nicely)
  const words = title.replace(/\?.*$/, '').replace(/[\u2014\u2013\u2010\u2012\u2013\u2014]/g, '|').split(/\||\s+/).filter(w => w.length > 0);
  let lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (test.length > 45 && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines = lines.slice(0, 3); // max 3 lines

  // Build text SVG elements
  const textElements = lines.map((l, i) =>
    `<text x="${W/2}" y="${H/2 - 30 + i * 48}" font-family="'Inter', 'Helvetica Neue', Arial, sans-serif" font-size="36" font-weight="800" fill="#0f172a" text-anchor="middle" letter-spacing="-0.5">${escXml(l)}</text>`
  ).join('\n    ');

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="50%" stop-color="${bgLight}"/>
      <stop offset="100%" stop-color="${bgMid}"/>
    </linearGradient>
    <pattern id="dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
      <circle cx="16" cy="16" r="1.2" fill="${hexToRGBA(tagColor, 0.12)}"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>
  <!-- Tag pill -->
  <rect x="${W/2 - 70}" y="${H/2 - 90}" width="140" height="34" rx="17" fill="${tagColor}" opacity="0.12"/>
  <text x="${W/2}" y="${H/2 - 66}" font-family="'Inter', Arial, sans-serif" font-size="14" font-weight="700" fill="${tagColor}" text-anchor="middle" letter-spacing="1">${escXml(displayTag)}</text>
  <!-- Title lines -->
    ${textElements}
  <!-- SiliconFeed watermark -->
  <text x="${W/2}" y="${H - 30}" font-family="'Inter', Arial, sans-serif" font-size="11" font-weight="500" fill="#94a3b8" text-anchor="middle" letter-spacing="0.5">SILICONFEED</text>
</svg>`;
}

function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function escXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// в”Ђв”Ђв”Ђ Brave image search в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
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
          // Block watermarked/stock images before using them
          if (await isWatermarkedOrStock(buf, url)) {
            return reject(new Error('watermarked or stock-photo'));
          }
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

// в”Ђв”Ђв”Ђ Parse posts в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
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

// в”Ђв”Ђв”Ђ Post-render quality check в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
async function qualityCheck(coverPath) {
  try {
    const meta = await sharp(coverPath).metadata();
    if (!meta.width || meta.width < 800) return `too small (${meta.width}x${meta.height})`;
    // Check center area
    const center = await sharp(coverPath)
      .extract({
        left: Math.floor(W * 0.2),
        top: Math.floor(H * 0.2),
        width: Math.floor(W * 0.6),
        height: Math.floor(H * 0.5),
      })
      .resize(32, 32)
      .raw()
      .toBuffer();
    let sum = 0;
    for (let i = 0; i < center.length; i += 3) sum += (center[i] + center[i+1] + center[i+2]) / 3;
    const avg = sum / (center.length / 3);
    let totalDev = 0;
    for (let i = 0; i < center.length; i += 3) {
      const px = (center[i] + center[i+1] + center[i+2]) / 3;
      totalDev += Math.abs(px - avg);
    }
    const contrast = totalDev / (center.length / 3);
    let edgeSum = 0, edgeCount = 0;
    const w = 32;
    for (let y = 0; y < 31; y++) {
      for (let x = 0; x < 31; x++) {
        const idx = (y * w + x) * 3;
        const diff = Math.abs(
          (center[idx] + center[idx+1] + center[idx+2]) / 3 -
          (center[idx+3] + center[idx+4] + center[idx+5]) / 3
        );
        edgeSum += diff;
        edgeCount++;
      }
    }
    const edgeStrength = edgeCount > 0 ? edgeSum / edgeCount : 0;
    // Sample top-left corner (canvas area, should be white)
    const corner = await sharp(coverPath)
      .extract({ left: 10, top: 20, width: 100, height: 100 })
      .resize(16, 16)
      .raw()
      .toBuffer();
    let cornerSum = 0;
    for (let i = 0; i < corner.length; i += 3) cornerSum += (corner[i] + corner[i+1] + corner[i+2]) / 3;
    const cornerAvg = cornerSum / (corner.length / 3);

    if (avg > 250 && contrast < 5) return `blank-near-white (avg:${avg.toFixed(0)})`;
    if (avg < 8 && contrast < 5 && cornerAvg < 20) return `blank-near-black (avg:${avg.toFixed(0)})`;
    if (contrast < 3 && edgeStrength < 3 && cornerAvg > 200) return `flat-no-content (avg:${avg.toFixed(0)}, edge:${edgeStrength.toFixed(1)})`;
    if (avg < 30 && contrast < 5 && cornerAvg < 30) return `blank-dark (avg:${avg.toFixed(0)})`;
    return null;
  } catch (e) {
    return 'check error: ' + e.message.substring(0, 60);
  }
}

// в”Ђв”Ђв”Ђ Main в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const posts = getAllPosts();
console.log(`Found ${posts.length} posts\n`);

(async () => {
  let done = 0;
  let skipped = 0;

  for (const post of posts) {
    const coverPath = path.join(coversDir, post.slug + '.jpg');
    const resolved = resolveLogoKey(post.tags, post.slug);
    let svgString, source;

    if (resolved) {
      const logoResult = findLogoPath(resolved.key);
      if (!logoResult) {
        console.log(`  SKIP (no logo): ${post.slug} -> ${resolved.key}`);
        skipped++;
        continue;
      }
      source = resolved.key;
      // Render ENTIRE cover (white bg + logo) at 3x via resvg, downscale with sharp
      const svgContent = fs.readFileSync(logoResult.path, 'utf8');
      try {
        // Wrap logo in a full-cover SVG
        const coverSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <image href="data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgContent)))}"
         x="${LOGO_X}" y="${LOGO_Y}" width="${LOGO_W}" height="${LOGO_H}"
         preserveAspectRatio="xMidYMid meet"/>
</svg>`;
        const renderSize = Math.round(W * 3);
        const hiResPng = new Resvg(coverSvg, {
          font: { loadSystemFonts: false },
          fitTo: { mode: 'width', value: renderSize }
        }).render().asPng();
        // Downscale with lanczos вЂ” clean anti-aliasing from high-res source
        await sharp(hiResPng)
          .resize(W, H, { kernel: 'lanczos3' })
          .jpeg({ quality: 90, mozjpeg: true })
          .toFile(coverPath);
        const issue = await qualityCheck(coverPath);
        if (issue) {
          console.log(`  WARN quality: ${post.slug} -> ${issue}`);
        } else {
          console.log(`  DONE: ${post.slug} -> ${source} вњ“ (3x)`);
        }
        done++;
      } catch (e) {
        console.log(`  ERR cover: ${post.slug}: ${e.message.substring(0, 130)}`);
      }
      continue;
    } else {
      console.log(`  SEARCH: ${post.slug}`);
      const imageBuffer = await fetchImageForTopic(post.slug, post.tags);
      source = imageBuffer ? 'custom-image' : 'text-fallback';
      svgString = source === 'custom-image'
        ? buildCustomCoverSVG(imageBuffer)
        : buildTextCoverSVG(post.title, post.tags);
    }

    try {
      const resvg = new Resvg(svgString, { font: { loadSystemFonts: true } });
      const pngData = resvg.render().asPng();
      await sharp(pngData).jpeg({ quality: 90 }).toFile(coverPath);

      const issue = await qualityCheck(coverPath);
      if (issue && source !== 'text-fallback') {
        console.log(`  RETRY (${issue}): ${post.slug}`);
        try { fs.unlinkSync(coverPath); } catch {}
        const fbSvg = buildTextCoverSVG(post.title, post.tags);
        const fbPng = new Resvg(fbSvg, { font: { loadSystemFonts: true } }).render().asPng();
        await sharp(fbPng).jpeg({ quality: 90 }).toFile(coverPath);
        const retry = await qualityCheck(coverPath);
        if (retry) {
          console.log(`  FAIL: ${post.slug} вЂ” ${retry}`);
          continue;
        }
        console.log(`  DONE (fallback): ${post.slug} вњ“`);
      } else if (issue) {
        console.log(`  WARN: ${post.slug} вЂ” ${issue}`);
      } else {
        console.log(`  DONE: ${post.slug} -> ${source} вњ“`);
      }
      done++;
    } catch (e) {
      console.log(`  ERR: ${post.slug}: ${e.message.substring(0, 130)}`);
    }
  }

  console.log(`\nGenerated: ${done}/${posts.length}`);
  if (skipped > 0) console.log(`Skipped: ${skipped}`);
})().catch(e => console.error(e));
