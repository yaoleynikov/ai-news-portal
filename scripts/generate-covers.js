const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const sharp = require('sharp');

const rootDir = __dirname.endsWith('scripts') ? path.join(__dirname, '..') : process.cwd();
const postsDir = path.join(rootDir, 'content', 'posts');
const logosDir = path.join(rootDir, 'public', 'logos');
const coversDir = path.join(rootDir, 'public', 'covers');

if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });

const tagCompanyMap = {
  'openai': 'openai', 'anthropic': 'anthropic', 'google': 'google',
  'microsoft': 'microsoft', 'nvidia': 'nvidia', 'meta': 'meta',
  'amazon': 'amazon', 'bitcoin': 'bitcoin', 'crypto': 'bitcoin',
  'ethereum': 'ethereum', 'coinbase': 'coinbase', 'stripe': 'stripe',
  'cloudflare': 'cloudflare', 'spacex': 'spacex', 'oracle': 'oracle',
  'claude': 'anthropic', 'chatgpt': 'openai', 'gemma': 'google',
  'gpt': 'openai', 'copilot': 'microsoft', 'gemini': 'google',
};

function resolveCompany(tags) {
  for (const tag of tags) {
    const key = tag.toLowerCase();
    for (const [k, v] of Object.entries(tagCompanyMap)) {
      if (key === k || key.includes(k)) return v;
    }
  }
  return null;
}

function findLogoFile(company) {
  // Google PNG is the colorful G, SVG is a white outline — prefer PNG for Google
  if (company === 'google') {
    for (const ext of ['.png', '.jpg', '.jpeg']) {
      const p = path.join(logosDir, company + ext);
      if (fs.existsSync(p)) return p;
    }
  }
  const svgP = path.join(logosDir, company + '.svg');
  if (fs.existsSync(svgP)) return svgP;
  for (const ext of ['.png', '.jpg', '.jpeg']) {
    const p = path.join(logosDir, company + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function buildSVG(logoBuffer, isSvg) {
  const mimeType = isSvg ? 'svg+xml' : 'png';
  const dataUri = `data:image/${mimeType};base64,${logoBuffer.toString('base64')}`;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="50%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
    <filter id="blur">
      <feGaussianBlur stdDeviation="80"/>
    </filter>
  </defs>

  <rect width="1200" height="630" fill="#ffffff"/>
  <rect width="1200" height="6" fill="url(#bar)"/>

  <!-- Blurred background: overscaled, 25% opacity -->
  <image href="${dataUri}" x="-1000" y="-1200" width="3200" height="3200"
         opacity="0.25" filter="url(#blur)"
         preserveAspectRatio="xMidYMid meet"/>

  <!-- Clear logo on top: 100% opaque, no transparency -->
  <image href="${dataUri}" x="270" y="136" width="660" height="346"
         opacity="1"
         preserveAspectRatio="xMidYMid meet"/>
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

const posts = getAllPosts();
console.log(`Found ${posts.length} posts`);

(async () => {
  let done = 0;
  for (const post of posts) {
    const company = resolveCompany(post.tags);
    if (!company) { console.log(`  SKIP (no company): ${post.slug}`); continue; }

    const logoPath = findLogoFile(company);
    if (!logoPath) { console.log(`  SKIP (no logo): ${post.slug} -> ${company}`); continue; }

    const logoBuffer = fs.readFileSync(logoPath);
    const isSvg = logoPath.endsWith('.svg');

    const coverPath = path.join(coversDir, post.slug + '.jpg');
    const svg = buildSVG(logoBuffer, isSvg);
    const resvg = new Resvg(svg, { font: { loadSystemFonts: true } });
    const pngData = resvg.render().asPng();
    await sharp(pngData).jpeg({ quality: 90 }).toFile(coverPath);
    console.log(`  DONE: ${post.slug} -> ${company} (${isSvg ? 'svg' : 'png'})`);
    done++;
  }
  console.log(`\nGenerated ${done} new covers`);
})().catch(e => console.error(e));
