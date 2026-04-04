const sharp = require('sharp');
const path = require('path');
const logosDir = path.join(process.cwd(), 'public', 'logos');

const missing = ['meta', 'ethereum', 'coinbase', 'cloudflare', 'spacex', 'freebsd', 'wikipedia'];

async function main() {
  for (const name of missing) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">
      <rect width="320" height="320" fill="transparent"/>
      <text x="160" y="170" text-anchor="middle" font-family="system-ui" font-size="48" font-weight="bold" fill="white">${name.toUpperCase()}</text>
    </svg>`;
    const pngPath = path.join(logosDir, name + '.png');
    await sharp(Buffer.from(svg))
      .resize({ width: 320, height: 320, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(pngPath);
    console.log('Created placeholder: ' + name + '.png');
  }
  console.log('Done!');
}

main().catch(e => console.error(e));
