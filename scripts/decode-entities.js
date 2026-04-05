const fs = require('fs');
const path = require('path');

const postsDir = path.join(__dirname, '..', 'content', 'posts');
const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));

function decodeHtmlEntities(str) {
  return str
    .replace(/&#8217;/g, '\u2019')
    .replace(/&#8216;/g, '\u2018')
    .replace(/&#39;/g, "\u0027")
    .replace(/&#8220;/g, '\u201C')
    .replace(/&#8221;/g, '\u201D')
    .replace(/&#8222;/g, '\u201E')
    .replace(/&#8230;/g, '\u2026')
    .replace(/&#8212;/g, '\u2014')
    .replace(/&#8211;/g, '\u2013')
    .replace(/&#160;/g, '\u00A0')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Generic numeric entity decoder
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

let updated = 0;
for (const file of files) {
  const filePath = path.join(postsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Decode HTML entities
  content = decodeHtmlEntities(content);

  // Fix corrupted emoji/unicode in "# Opinion" and "SiliconFeed\u00A0\ud83d\udce1" lines
  // Replace any non-ASCII garbage after "Opinion" with clean text
  content = content.replace(/^## Opinion\s+.+$/gm, '## Opinion');

  // Also fix em dash that might be corrupted by Windows console
  content = content.replace(/\uFFFD/g, '\u2014');

  fs.writeFileSync(filePath, content, { encoding: 'utf8' });
  
  console.log(`  \u2705 ${file}`);
  updated++;
}

console.log(`\nWrote ${updated}/${files.length} files with clean encoding`);
