const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const sharp = require('sharp');

// Read SVG
let svg = fs.readFileSync('public/logos/freebsd.svg', 'utf8');

// Test 1: Direct render at target size
const r1 = new Resvg(svg, { font: { loadSystemFonts: false }, fitTo: { mode: 'width', value: 600 } });
const png1 = r1.render().asPng();
fs.writeFileSync('C:/Users/yaole/AppData/Local/Temp/test-freebsd-direct.png', png1);
console.log('1. Direct 600px render written');

// Test 2: Render at 2400px, downscale with sharp
const r2 = new Resvg(svg, { font: { loadSystemFonts: false }, fitTo: { mode: 'width', value: 2400 } });
const pngHi = r2.render().asPng();
sharp(pngHi).resize(600, 600, { fit: 'contain' }).png({ compressionLevel: 9 }).toFile('C:/Users/yaole/AppData/Local/Temp/test-freebsd-downscale.png')
  .then(() => console.log('2. 2400→600 downscale written'))
  .catch(e => console.error('Downscale error:', e.message));

// Test 3: Render at 4800px, downscale
const r3 = new Resvg(svg, { font: { loadSystemFonts: false }, fitTo: { mode: 'width', value: 4800 } });
const pngHi2 = r3.render().asPng();
sharp(pngHi2).resize(600, 600, { fit: 'contain' }).png({ compressionLevel: 9 }).toFile('C:/Users/yaole/AppData/Local/Temp/test-freebsd-downscale-8x.png')
  .then(() => console.log('3. 4800→600 downscale written'))
  .catch(e => console.error('Downscale error:', e.message));
