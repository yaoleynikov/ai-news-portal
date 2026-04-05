import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const postsDir = path.join(__dirname, '..', 'content', 'posts');
const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));

let fixed = 0;

for (const file of files) {
  const filePath = path.join(postsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Extract frontmatter
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) continue;
  
  const fm = fmMatch[1];
  const lines = fm.split('\n');
  let newFm = [];
  let changed = false;

  for (const line of lines) {
    // Fix title: unescape " inside the quoted value
    const titleMatch = line.match(/^title:\s*"(.*)"$/);
    if (titleMatch) {
      const val = titleMatch[1].replace(/"/g, "'");
      newFm.push(`title: "${val}"`);
      changed = true;
      continue;
    }
    // Fix excerpt: unescape " inside quoted value
    const exMatch = line.match(/^excerpt:\s*"(.+)"$/);
    if (exMatch) {
      const val = exMatch[1].replace(/"/g, "'");
      newFm.push(`excerpt: "${val}"`);
      changed = true;
      continue;
    }
    newFm.push(line);
  }

  if (changed) {
    const newContent = `---\n${newFm.join('\n')}\n---\n${content.substring(fmMatch[0].length + (content[fmMatch[0].length] === '\n' ? 1 : 0))}`;
    fs.writeFileSync(filePath, newContent, 'utf8');
    fixed++;
    console.log(`  ✅ ${file}`);
  }
}

console.log(`\nFixed ${fixed}/${files.length} files`);
