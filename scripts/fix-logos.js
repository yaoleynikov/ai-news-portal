/** Download SVG logos from SimpleIcons for white-on-transparent PNGs, add fill */
const https = require('https');
const fs = require('fs');
const path = require('path');

const logosDir = path.join(__dirname, '..', 'public', 'logos');

// These PNGs are white-on-transparent — need SVG replacements
const items = ['cloudflare', 'coinbase', 'meta', 'spacex', 'wikipedia'];
const allDone = ['openai', 'anthropic', 'google', 'microsoft', 'nvidia', 'amazon', 'bitcoin', 'oracle', 'stripe', 'algorand', 'ethereum', 'tesla', 'baidu', 'claude-code', 'freebsd'];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if ([301,302,307,308].includes(res.statusCode) && res.headers.location) {
        return downloadFile(res.headers.location, dest).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

function addFill(svg, color = '#1a1a1a') {
  return svg.replace(/(<path\b)([^>]*?)(\/?>)/g, (m, open, attrs, close) => {
    if (/fill\s*=/.test(attrs)) return m;
    return `${open} fill="${color}"${attrs}${close}`;
  });
}

(async () => {
  for (const name of items) {
    const svgPath = path.join(logosDir, name + '.svg');
    const pngPath = path.join(logosDir, name + '.png');

    // Check if SVG already exists with fill
    if (fs.existsSync(svgPath)) {
      const svg = fs.readFileSync(svgPath, 'utf8');
      if (/fill\s*=\s*["']#[0-9a-fA-F]/.test(svg)) {
        console.log(`✓ ${name}.svg already has fill`);
      } else {
        const fixed = addFill(svg);
        fs.writeFileSync(svgPath, fixed, 'utf8');
        console.log(`✓ ${name}.svg — added fill`);
      }
    } else {
      // Download SVG from SimpleIcons
      const url = `https://simpleicons.org/icons/${name}.svg`;
      console.log(`  Downloading ${name}.svg from ${url}...`);
      const svgRaw = await downloadFile(url);
      const svg = svgRaw.toString('utf8');
      const fixed = addFill(svg);
      fs.writeFileSync(svgPath, fixed, 'utf8');
      console.log(`✓ ${name}.svg downloaded + fill added`);
    }

    // Remove old white PNG
    if (fs.existsSync(pngPath)) {
      fs.unlinkSync(pngPath);
      console.log(`  Removed ${name}.png`);
    }
  }

  // Log final logo inventory
  console.log('\nLogo inventory:');
  const files = fs.readdirSync(logosDir).sort();
  for (const f of files) {
    console.log(`  ${f}`);
  }
})().catch(e => console.error('Error:', e));
