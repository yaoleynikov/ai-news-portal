/** Quick check: find PNG logos that are white-on-transparent */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const logosDir = path.join(__dirname, '..', 'public', 'logos');

(async () => {
  const pngs = fs.readdirSync(logosDir).filter(f => /\.(png|jpg|jpeg|webp)$/.test(f));
  for (const f of pngs) {
    const p = path.join(logosDir, f);
    const meta = await sharp(p).metadata();
    if (!meta.hasAlpha) continue;
    // Get raw data
    const buf = await sharp(p).resize(100, 100).raw().toBuffer();
    let sum = 0, cnt = 0;
    for (let i = 0; i < buf.length; i += 4) {
      if (buf[i + 3] > 0) {
        sum += (buf[i] + buf[i+1] + buf[i+2]) / 3;
        cnt++;
      }
    }
    const avg = cnt > 0 ? sum / cnt : 0;
    if (avg > 248) {
      console.log(`⚠ ${f} — avg brightness: ${avg.toFixed(0)} (white-on-transparent)`);
    } else if (avg > 200) {
      console.log(`  ${f} — avg brightness: ${avg.toFixed(0)} (very light)`);
    } else {
      console.log(`✓ ${f} — avg brightness: ${avg.toFixed(0)}`);
    }
  }
})().catch(e => console.error(e));
