const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const sharp = require('sharp');

const rootDir = __dirname.endsWith('scripts') ? path.join(__dirname, '..') : process.cwd();
const postsDir = path.join(rootDir, 'content', 'posts');
const logosDir = path.join(rootDir, 'public', 'logos');
const coversDir = path.join(rootDir, 'public', 'covers');

function resolveCompany(tags) {
  const aliases = {
    claude: 'anthropic', chatgpt: 'openai', gpt: 'openai',
    gemma: 'google', gemini: 'google', copilot: 'microsoft',
    crypto: 'bitcoin', robotaxi: 'baidu',
  };
  for (const tag of tags) {
    const key = tag.toLowerCase();
    if (aliases[key]) return aliases[key];
  }

  const priority = ['anthropic', 'openai', 'google', 'microsoft', 'nvidia',
    'meta', 'amazon', 'bitcoin', 'ethereum', 'coinbase', 'stripe',
    'cloudflare', 'oracle', 'spacex', 'freebsd', 'algorand',
    'baidu', 'wikipedia', 'startup'];

  for (const p of priority) {
    if (tags.some(t => t.toLowerCase() === p)) return p;
  }
  for (const p of priority) {
    if (tags.some(t => t.toLowerCase().includes(p))) return p;
  }
  // Default fallback
  return 'ai-generic';
}

function findLogo(company) {
  for (const ext of ['.png', '.jpg', '.jpeg']) {
    const p = path.join(logosDir, company + ext);
    if (fs.existsSync(p)) return { buffer: fs.readFileSync(p), isSvg: false };
  }
  const svgP = path.join(logosDir, company + '.svg');
  if (fs.existsSync(svgP)) return { buffer: fs.readFileSync(svgP), isSvg: true };
  return null;
}

function buildSVG(buffer, isSvg) {
  const mime = isSvg ? 'svg+xml' : 'png';
  const dataUri = `data:image/${mime};base64,${buffer.toString('base64')}`;
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
    const logo = findLogo(company);
    if (!logo) { console.log(`  SKIP: ${post.slug} -> ${company}`); continue; }
    try {
      const svg = buildSVG(logo.buffer, logo.isSvg);
      const resvg = new Resvg(svg, { font: { loadSystemFonts: true } });
      const pngData = resvg.render().asPng();
      const coverPath = path.join(coversDir, post.slug + '.jpg');
      await sharp(pngData).jpeg({ quality: 90 }).toFile(coverPath);
      console.log(`  DONE: ${post.slug} -> ${company} (${logo.isSvg ? 'svg' : 'png'})`);
      done++;
    } catch (e) {
      console.log(`  ERR: ${post.slug}: ${e.message.substring(0, 130)}`);
    }
  }
  console.log(`\nGenerated ${done} covers`);
})().catch(e => console.error(e));
