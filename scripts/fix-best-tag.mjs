import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const postsDir = path.join(__dirname, '..', 'content', 'posts');
const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));

// Fix articles with "BEST" or single-word bad tags
const badTagPatterns = [/^BEST$/i, /^TECH$/i, /^AI$/i];

let fixed = 0;
for (const file of files) {
  const filePath = path.join(postsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check tags line
  const tagsMatch = content.match(/^tags:\s*\[([^\]]+)\]/m);
  if (!tagsMatch) continue;
  
  const tags = tagsMatch[1].split(',').map(t => t.trim().replace(/["']/g, ''));
  const hasBadTag = tags.some(t => badTagPatterns.some(p => p.test(t)));
  
  if (hasBadTag) {
    // Read title and generate better tags from title text
    const titleMatch = content.match(/^title:\s*["']([^"']+)["']/m);
    const title = titleMatch ? titleMatch[1] : '';
    const lower = title.toLowerCase();
    
    const newTags = [];
    if (/\b(ios|ipad|iphone|macbook|ipod)\b/.test(lower)) newTags.push('Gadgets');
    if (/\bapple\b/.test(lower)) newTags.push('Big-Tech');
    if (/\b(productivity|app)\b/.test(lower)) newTags.push('Software');
    if (/\b(ai|gpt|claude|openai|chatgpt|llm)\b/.test(lower)) newTags.push('AI');
    if (/\b(crypto|bitcoin|ethereum|blockchain)\b/.test(lower)) newTags.push('Crypto');
    if (/\b(startup|funding|series|seed|ipo)\b/.test(lower)) newTags.push('Startups');
    if (/\b(google|meta|microsoft|amazon|apple|openai|anthropic)\b/.test(lower)) newTags.push('Big-Tech');
    if (/\b(gaming|game|nintendo|playstation|xbox)\b/.test(lower)) newTags.push('Gaming');
    if (/\b(robot|drone|humanoid)\b/.test(lower)) newTags.push('Robotics');
    if (/\b(security|hack|breach|malware|vulnerability|cve)\b/.test(lower)) newTags.push('Cybersecurity');
    if (/\b(spacex|nasa|mars|moon|satellite)\b/.test(lower)) newTags.push('Space');
    if (/\b(solar|nuclear|energy|fusion|battery)\b/.test(lower)) newTags.push('Energy');
    if (/\b(youtube|tiktok|social|twitter|instagram|reddit)\b/.test(lower)) newTags.push('Social');
    if (/\b(chip|gpu|cpu|nvidia|amd|intel|semiconductor)\b/.test(lower)) newTags.push('Hardware');
    if (/\b(cloud|aws|azure|serverless|kubernetes)\b/.test(lower)) newTags.push('Cloud');
    if (/\b(auto|tesla|ev|lucid|rivian)\b/.test(lower)) newTags.push('Automotive');
    
    if (newTags.length === 0) newTags.push('Tech');
    const unique = [...new Set(newTags)].slice(0, 4);
    const tagsStr = unique.map(t => `"${t}"`).join(', ');
    
    content = content.replace(
      /^tags:\s*\[[^\]]+\]/m,
      `tags: [${tagsStr}]`
    );
    
    fs.writeFileSync(filePath, content, 'utf8');
    fixed++;
    console.log(`  ✅ ${file} -> [${unique.join(', ')}]`);
  }
}

console.log(`\nFixed ${fixed}/${files.length} files`);
