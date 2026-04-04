// Download SVG replacements for all problematic PNG logos from SimpleIcons
const https = require('https');
const fs = require('fs');
const path = require('path');

const logosDir = path.join(__dirname, '..', 'public', 'logos');
const SVG_FILL = '#000000';

const logos = ['amazon', 'google', 'microsoft', 'stripe', 'tesla', 'bitcoin', 'oracle', 'baidu', 'freebsd', 'algorand', 'coinbase', 'cloudflare', 'meta', 'spacex', 'wikipedia', 'ethereum', 'claude-code'];

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if ([301,302,307,308].includes(res.statusCode) && res.headers.location) {
        return download(res.headers.location).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function main() {
  for (const name of logos) {
    const svgPath = path.join(logosDir, name + '.svg');
    const pngPath = path.join(logosDir, name + '.png');
    
    if (fs.existsSync(svgPath)) {
      // Check if it has fill
      const c = fs.readFileSync(svgPath, 'utf8');
      if (/fill\s*=\s*["']#[0-9a-fA-F]/.test(c)) {
        console.log(`✓ ${name}.svg already has fill`);
      } else {
        const fixed = c.replace(/(<path\b)/g, `$1 fill="${SVG_FILL}"`);
        fs.writeFileSync(svgPath, fixed, 'utf8');
        console.log(`✓ ${name}.svg — added fill`);
      }
      // Remove old PNG
      if (fs.existsSync(pngPath)) {
        fs.unlinkSync(pngPath);
        console.log(`  Removed ${name}.png`);
      }
    } else {
      console.log(`  Downloading ${name}.svg...`);
      const buf = await download(`https://simpleicons.org/icons/${name}.svg`);
      let svg = buf.toString('utf8');
      svg = svg.replace(/(<path\b)/g, `$1 fill="${SVG_FILL}"`);
      fs.writeFileSync(svgPath, svg, 'utf8');
      console.log(`✓ ${name}.svg downloaded + fill added`);
      if (fs.existsSync(pngPath)) {
        fs.unlinkSync(pngPath);
        console.log(`  Removed ${name}.png`);
      }
    }
  }
  
  // List what's left
  console.log('\nRemaining logos:');
  fs.readdirSync(logosDir).forEach(f => console.log(`  ${f}`));
}

main().catch(e => console.error(e));
