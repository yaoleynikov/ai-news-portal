const { execSync } = require('child_process');
const cwd = 'C:\\Users\\yaole\\.openclaw\\workspace\\ai-site-temp';

try {
  console.log('--- git commit ---');
  const out = execSync('git commit -m "Auto-publish 2026-04-05: 3 new articles + covers"', {
    cwd, shell: 'cmd.exe', encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit']
  });
  console.log(out);
} catch (e) {
  console.log(e.stdout || '', e.stderr || '');
  if (e.stdout && e.stdout.includes('nothing to commit')) {
    console.log('Nothing to commit.');
  } else if (e.stderr && e.stderr.includes('nothing to commit')) {
    console.log('Nothing to commit.');
  } else {
    // still try push
    try {
      console.log('--- git push ---');
      const pushOut = execSync('git push', { cwd, shell: 'cmd.exe', encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });
      console.log(pushOut);
    } catch (e2) { console.log(e2.stdout || '', e2.stderr || ''); }
    process.exit(0);
  }
}

try {
  console.log('--- git push ---');
  const pushOut = execSync('git push', { cwd, shell: 'cmd.exe', encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });
  console.log(pushOut);
} catch (e) {
  console.log(e.stdout || '', e.stderr || '');
}

// final status
console.log('--- git status ---');
const status = execSync('git status', { cwd, shell: 'cmd.exe', encoding: 'utf8' });
console.log(status);
