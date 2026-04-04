const fs=require('fs');
const p='C:/Users/yaole/.openclaw/workspace/ai-site-temp/src/app/globals.css';
let c=fs.readFileSync(p,'utf8');
// Fix double percent
c=c.replace('.a-img { width: 100%%;', '.a-img { width: 100%;');
// Remove the old breakpoint rule that references .a-img
c=c.replace('.a-img { width: 100%; margin: 0 0 32px; height: 260px; }', '');
// Also remove the min-width override
c=c.replace(/\n@media \(min-width: 1168px\) \{ \.a-img \{ width: 1120px; \} \}/, '');
// Also remove the responsive a-img override
c = c.replace('@media (max-width: 800px) {\n  body { font-size: 16px; }\n  .logo { font-size: 22px; }\n  .nav { top: 60px; }\n  .a-img { width: calc(100vw - 48px); margin: 0 0 32px; height: 260px; }\n}', '@media (max-width: 800px) {\n  body { font-size: 16px; }\n  .logo { font-size: 22px; }\n  .nav { top: 60px; }\n}');
fs.writeFileSync(p,c);
console.log('All fixed');