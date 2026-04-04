const fs = require('fs');
const path = require('path');

const p = 'C:/Users/yaole/.openclaw/workspace/ai-site-temp/content/posts';
const files = fs.readdirSync(p).filter(f => f.endsWith('.md'));

// Update all articles to not use youtubeId for cover (use loremflickr via posts.ts)
// But keep youtubeId for embeds
for (const f of files) {
  const fp = path.join(p, f);
  let c = fs.readFileSync(fp, 'utf8');
  
  // Ensure author is SiliconFeed
  c = c.replace(/author:\s*"[^"]*"/, 'author: "SiliconFeed Team"');
  c = c.replace(/author:\s*'[^']*'/, "author: 'SiliconFeed Team'");
  
  fs.writeFileSync(fp, c);
}

console.log('Updated', files.length, 'articles');
