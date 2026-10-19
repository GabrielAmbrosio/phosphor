// Generates the README screenshots: one window per skin, saved to docs/img/.
// Usage: npm run shots
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const electron = require('electron'); // path to the electron executable
const root = path.join(__dirname, '..');
const out = path.join(root, 'docs', 'img');
fs.mkdirSync(out, { recursive: true });

const demo = [
  "function prompt { 'user@phosphor:~$ ' }",
  'Clear-Host',
  "Write-Host 'PHOSPHOR - a CRT terminal for Windows' -ForegroundColor White",
  "Write-Host ''",
  "Write-Host 'user@phosphor:~$ ls -l projects'",
  "Write-Host 'drwxr-xr-x  api' -ForegroundColor Cyan",
  "Write-Host 'drwxr-xr-x  docs' -ForegroundColor Cyan",
  "Write-Host '-rw-r--r--  notes.txt' -ForegroundColor Gray",
  "Write-Host '-rwxr-xr-x  build.sh' -ForegroundColor Green",
  "Write-Host ''",
  "Write-Host 'user@phosphor:~$ git status' -ForegroundColor White",
  "Write-Host 'On branch main' -ForegroundColor DarkGray",
  "Write-Host 'nothing to commit, working tree clean' -ForegroundColor DarkGray",
  "Write-Host ''",
].join('; ');

const skins = ['Green P1', 'Atomic', 'Sepia', 'Amber 80s', 'Cool Cyan', 'IBM Blue', 'White P4', 'Clean'];
const env = { ...process.env, PHOSPHOR_SHOT_MS: '6000' };
delete env.ELECTRON_RUN_AS_NODE;

// Optional filter: npm run shots -- "Cool Cyan"
for (const skin of skins.filter((s) => !process.argv[2] || s === process.argv[2])) {
  const file = path.join(out, `skin-${skin.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`);
  env.PHOSPHOR_SHOT = file;
  console.log(`${skin} -> ${path.relative(root, file)}`);
  spawnSync(electron, ['.', demo, `--phosphor-skin=${skin}`, '--phosphor-boot=0', '--phosphor-fresh=1'], {
    cwd: root,
    env,
    stdio: 'ignore',
  });
}
