const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const sharp = require('sharp');

// --- Config ---
const rootDir = __dirname.endsWith('scripts') ? path.join(__dirname, '..') : process.cwd();
const postsDir = path.join(rootDir, 'content', 'posts');
const logosDir = path.join(rootDir, 'public', 'logos');
const coversDir = path.join(rootDir, 'public', 'covers');

if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });

// --- Data ---
console.log('postsDir:', postsDir);
console.log('exists:', fs.existsSync(postsDir));

function getAllPosts() {
  const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
  console.log('Found', files.length, 'md files');
  const results = files.map(filename => {
    const raw = fs.readFileSync(path.join(postsDir, filename), 'utf-8').replace(/^\uFEFF/, '');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) {
      console.log('  NO FRONTMATTER:', filename);
      return null;
    }
    const fm = match[1];
    // Extract title - with or without quotes
    const titleLine = fm.match(/title:\s*(.+)$/m);
    if (!titleLine) {
      console.log('  NO TITLE:', filename);
    }
    let title = 'Untitled';
    if (titleLine) {
      title = titleLine[1].trim().replace(/^\s*["']/, '').replace(/["']\s*$/, '');
    }
    const tagsMatch = fm.match(/^tags:\s*\[([^\]]+)\]/m);
    const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, '')) : ['Tech'];
    const tag = tags[0] || 'Tech';
    const slug = filename.replace(/\.md$/, '');
    return { slug, title, tag, tags };
  });
  const valid = results.filter(Boolean);
  console.log('Valid posts:', valid.length, 'out of', results.length);
  return valid;
}

const tagCompanyMap = {
  'openai': 'openai', 'anthropic': 'anthropic', 'google': 'google',
  'microsoft': 'microsoft', 'nvidia': 'nvidia', 'meta': 'meta',
  'amazon': 'amazon', 'bitcoin': 'bitcoin', 'crypto': 'bitcoin',
  'ethereum': 'ethereum', 'coinbase': 'coinbase', 'stripe': 'stripe',
  'cloudflare': 'cloudflare', 'spacex': 'spacex', 'oracle': 'oracle',
  'wikipedia': 'wikipedia', 'freebsd': 'freebsd', 'claude': 'anthropic',
  'chatgpt': 'openai', 'gemma': 'google', 'gpt': 'openai',
  'copilot': 'microsoft', 'gemini': 'google', 'algorand': 'algorand',
  'tesla': 'tesla', 'open source': null, 'hardware': null,
  'security': null, 'startups': null, 'ai': null, 'cloud': null,
};

function resolveCompany(tags) {
  for (const tag of tags) {
    const key = tag.toLowerCase();
    for (const [k, v] of Object.entries(tagCompanyMap)) {
      if (key.includes(k)) {
        if (v) return v; // found a company
      }
    }
  }
  return null;
}

function loadSVG(name) {
  const p = path.join(logosDir, name + '.svg');
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf-8');
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function wrapText(text, maxCharsPerLine) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (test.length > maxCharsPerLine && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  if (lines.length > 4) {
    return [...lines.slice(0, 3), lines.slice(3).join(' ') + '…'];
  }
  return lines;
}

function buildSVG(post) {
  const company = post._noLogo ? null : resolveCompany(post.tags);
  let logoElements = '';
  
  if (company) {
    const raw = loadSVG(company);
    if (raw) {
      const innerMatch = raw.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
      if (innerMatch) {
        logoElements = `
          <!-- Blurred background logo (6% opacity, 40% size center) -->
          <g opacity="0.06" filter="url(#blur)">
            <g transform="translate(350, 65)">
              ${innerMatch[1]}
            </g>
          </g>
          <!-- Clear logo at 40% opacity, bottom-right area -->
          <g opacity="0.40">
            <g transform="translate(800, 120) scale(1.5)">
              ${innerMatch[1]}
            </g>
          </g>
        `;
      }
    }
  }

  const titleLines = wrapText(post.title, 46);
  const lineHeight = 68;
  const titleBlockH = titleLines.length * lineHeight;
  const startY = (630 - titleBlockH) / 2 + 15;
  
  const titleEl = titleLines.map((line, i) =>
    `    <text x="40" y="${startY + i * lineHeight}" fill="#0f172a" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="52" letter-spacing="-0.02em">${escapeXml(line)}</text>`
  ).join('\n');

  const tagText = post.tag.toUpperCase();
  const tagWidth = tagText.length * 14 + 48;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="50%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
    <filter id="blur" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="25"/>
    </filter>
  </defs>

  <rect width="1200" height="630" fill="#ffffff"/>
  <rect width="1200" height="6" fill="url(#bar)"/>
  
  ${logoElements}

  <!-- Tag badge -->
  <g>
    <rect x="40" y="28" width="${tagWidth}" height="34" rx="17" fill="rgba(0,0,0,0.06)"/>
    <text x="${40 + tagWidth / 2}" y="49" fill="#475569" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="17" text-anchor="middle" letter-spacing="3">${escapeXml(tagText)}</text>
  </g>

  <!-- Title -->
${titleEl}
  
  <!-- Bottom branding -->
  <text x="40" y="600" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="16">siliconfeed.online</text>
</svg>`;
}

// --- Main ---
const posts = getAllPosts();
console.log(`Found ${posts.length} posts`);

(async () => {
  let done = 0;
  for (const post of posts) {
    const coverPath = path.join(coversDir, post.slug + '.jpg');
    if (fs.existsSync(coverPath)) {
      console.log(`  SKIP: ${post.slug}`);
      continue;
    }

    const svg = buildSVG(post);
    try {
      const resvg = new Resvg(svg, { font: { loadSystemFonts: true } });
      const pngData = resvg.render().asPng();
      await sharp(pngData).jpeg({ quality: 90 }).toFile(coverPath);
      console.log(`  DONE: ${post.slug}`);
      done++;
    } catch (e) {
      console.log(`  ERROR: ${post.slug} - ${e.message}`);
      // Fallback: retry with simple SVG (no logo)
      const simpleSvg = buildSVG({ ...post, _noLogo: true });
      const resvg = new Resvg(simpleSvg, { font: { loadSystemFonts: true } });
      const pngData = resvg.render().asPng();
      await sharp(pngData).jpeg({ quality: 90 }).toFile(coverPath);
      console.log(`  DONE (no logo): ${post.slug} `);
      done++;
    }
  }
  console.log(`\nGenerated ${done} new covers, ${posts.length - done} skipped`);
})().catch(e => console.error(e));
