const fs = require('fs');
const path = require('path');

const postsDir = __dirname === '.' ? 'content/posts' : path.join(__dirname, '..', 'content', 'posts');

const priority = ['anthropic', 'openai', 'google', 'microsoft', 'nvidia',
  'meta', 'amazon', 'bitcoin', 'ethereum', 'coinbase', 'stripe',
  'cloudflare', 'oracle', 'spacex', 'freebsd', 'algorand', 'baidu',
  'wikipedia'];

const aliases = {
  claude: 'anthropic', chatgpt: 'openai', gpt: 'openai',
  gemma: 'google', gemini: 'google', copilot: 'microsoft',
  crypto: 'bitcoin', robotaxi: 'baidu',
};

function resolveCompany(tags) {
  for (const tag of tags) {
    const key = tag.toLowerCase();
    if (aliases[key]) return aliases[key];
  }
  for (const p of priority) {
    if (tags.some(t => t.toLowerCase() === p)) return p;
  }
  for (const p of priority) {
    if (tags.some(t => t.toLowerCase().includes(p))) return p;
  }
  return null;
}

const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
for (const f of files) {
  const raw = fs.readFileSync(path.join(postsDir, f), 'utf-8').replace(/^\uFEFF/, '');
  const tagsMatch = raw.match(/^tags:\s*\[([^\]]+)\]/m);
  const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, '')) : [];
  const company = resolveCompany(tags);
  if (!company) {
    console.log(`NO LOGO: ${f.replace('.md','')} [${tags.join(', ')}]`);
  }
}
