import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const postsDir = path.join(__dirname, '..', 'content', 'posts');

const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));

for (const f of files) {
  const content = fs.readFileSync(path.join(postsDir, f), 'utf8');
  const match = content.match(/^---[\r\n]([\s\S]*?)[\r\n]---/);
  if (!match) {
    console.log('NO FRONTMATTER:', f);
    continue;
  }
  const fm = match[1];
  // Check for unquoted titles with special chars
  const titleMatch = fm.match(/^title:\s*(.+)$/m);
  if (titleMatch) {
    const raw = titleMatch[1].trim();
    if (!raw.startsWith('"') && !raw.startsWith("'")) {
      // Unquoted title - check for problematic chars
      if (/[":#{}\[\],|>&*!%@`]/.test(raw)) {
        console.log('UNQUOTED TITLE WITH SPECIAL CHARS:', f, '->', raw.substring(0, 80));
      }
    }
  }
  // Check for unescaped quotes in values
  const lines = fm.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check if a value has unbalanced quotes
    if (/^[a-zA-Z_]:.*"[^"]*$/.test(line)) {
      console.log('UNBALANCED QUOTE:', f, 'line', i+1, '->', line.substring(0, 80));
    }
    // Check for unquoted value containing ':'
    if (/^[a-zA-Z_]+:\s*[^"'].*:[^"']$/.test(line) && !line.match(/^\s{2,}/)) {
      console.log('UNQUOTED COLON:', f, 'line', i+1, '->', line.substring(0, 80));
    }
  }
}

console.log('\nDone checking', files.length, 'files');
