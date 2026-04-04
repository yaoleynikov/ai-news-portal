const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const logosDir = path.join(__dirname, '..', 'public', 'logos');

(async () => {
  const pngs = fs.readdirSync(logosDir).filter(f => /\.(png|jpg|jpeg|webp)$/.test(f));
  console.log('Checking PNGs for transparency artifacts...\n');
  
  const issues = [];
  for (const f of pngs) {
    const p = path.join(logosDir, f);
    const meta = await sharp(p).metadata();
    if (!meta.hasAlpha) {
      console.log(`✓ ${f} — no alpha`);
      continue;
    }
    // Get raw data
    const raw = await sharp(p).resize(200, 200).raw().toBuffer();
    let semiTransp = 0;
    let graySemi = 0;
    for (let i = 0; i < raw.length; i += 4) {
      if (raw[i + 3] > 0 && raw[i + 3] < 240) {
        semiTransp++;
        const avg = (raw[i] + raw[i + 1] + raw[i + 2]) / 3;
        // Semi-transparent pixels that are gray (not matching fill color)
        // are usually checkerboard artifacts
        if (avg > 80 && avg < 200) {
          graySemi++;
        }
      }
    }
    const totalPx = 200 * 200;
    const pctSemi = (semiTransp / totalPx * 100).toFixed(1);
    if (graySemi > 20 || semiTransp > totalPx * 0.1) {
      console.log(`⚠ ${f} — semi: ${pctSemi}% (${semiTransp}px), gray: ${graySemi}`);
      issues.push(f);
    } else {
      console.log(`  ${f} — semi: ${pctSemi}% (${semiTransp}px) — acceptable`);
    }
  }
  
  if (issues.length > 0) {
    console.log(`\n⚠ ${issues.length} logo(s) need replacement from SimpleIcons:`);
    issues.forEach(f => {
      const name = f.split('.')[0];
      console.log(`  https://simpleicons.org/icons/${name}.svg`);
    });
  } else {
    console.log('\n✓ All logos look clean');
  }
})().catch(e => console.error(e));
