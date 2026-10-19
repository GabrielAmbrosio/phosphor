const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const pty = require('@lydell/node-pty');

let win = null;
let term = null;

// Test mode uses its own profile folder so it can run next to a normal window.
if (process.env.PHOSPHOR_SHOT) {
  app.setPath('userData', path.join(require('os').tmpdir(), `phosphor-test-${process.pid}`));
}

// electron . [command...]  -> opens PowerShell and runs the command (e.g. claude)
// Flags starting with "--" are ignored here; "--phosphor-*" flags are forwarded to the renderer.
function launchArgs() {
  const raw = process.argv.slice(app.isPackaged ? 1 : 2).filter((a) => !a.startsWith('--'));
  if (raw.length === 0) return ['powershell.exe', ['-NoLogo']];
  return ['powershell.exe', ['-NoLogo', '-NoExit', '-Command', raw.join(' ')]];
}

// --phosphor-cwd=DIR sets the starting directory (default: the user's home folder).
function startDir() {
  const arg = process.argv.find((a) => a.startsWith('--phosphor-cwd='));
  const dir = arg ? arg.slice('--phosphor-cwd='.length) : '';
  return dir && require('fs').existsSync(dir) ? dir : process.env.USERPROFILE || process.cwd();
}

// Do not inherit variables from the process that launched the app (another Claude Code session, VS Code's Electron).
function cleanEnv() {
  const env = { ...process.env, TERM_PROGRAM: 'phosphor' };
  for (const k of Object.keys(env)) {
    if (k === 'ELECTRON_RUN_AS_NODE' || k === 'CLAUDECODE' || k.startsWith('CLAUDE_CODE_')) delete env[k];
  }
  return env;
}

function startPty(cols, rows) {
  const [file, args] = launchArgs();
  term = pty.spawn(file, args, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: startDir(),
    env: cleanEnv(),
  });
  term.onData((d) => win && !win.isDestroyed() && win.webContents.send('pty:data', d));
  term.onExit(() => app.quit());
}

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 480,
    minHeight: 320,
    backgroundColor: '#000000',
    show: false,
    title: 'PHOSPHOR',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments: process.argv.filter((a) => a.startsWith('--phosphor-')),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Throttle when hidden; test mode keeps rendering so screenshots always work.
      backgroundThrottling: !process.env.PHOSPHOR_SHOT,
      spellcheck: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  // F11 toggles fullscreen.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
  // Test mode opens the window without stealing focus from whatever is being typed elsewhere.
  win.once('ready-to-show', () => {
    if (process.env.PHOSPHOR_SHOT) { win.showInactive(); return; }
    win.show();
    win.focus();
  });
  Menu.setApplicationMenu(null);
  win.loadFile('index.html');

  // Test mode: PHOSPHOR_SHOT=path.png saves a screenshot of the window and quits.
  if (process.env.PHOSPHOR_SHOT) {
    win.webContents.on('console-message', (_e, _l, msg) => console.log('[renderer]', msg));
    if (process.env.PHOSPHOR_PANEL) {
      setTimeout(() => {
        for (const type of ['keyDown', 'keyUp']) win.webContents.sendInputEvent({ type, keyCode: 'F10' });
      }, (Number(process.env.PHOSPHOR_SHOT_MS) || 4000) - 1500);
    }
    // PHOSPHOR_STATS=1 prints memory and CPU per Electron process shortly before the screenshot.
    if (process.env.PHOSPHOR_STATS) {
      const ms = Number(process.env.PHOSPHOR_SHOT_MS) || 4000;
      setTimeout(() => app.getAppMetrics(), ms - 6000); // first call only primes the CPU counters
      setTimeout(() => {
        let mem = 0;
        let cpu = 0;
        for (const p of app.getAppMetrics()) {
          const mb = p.memory.workingSetSize / 1024;
          mem += mb;
          cpu += p.cpu.percentCPUUsage;
          console.log(`[stats] ${String(p.type).padEnd(9)} ${mb.toFixed(0).padStart(5)} MB  cpu ${p.cpu.percentCPUUsage.toFixed(1)}%`);
        }
        console.log(`[stats] TOTAL     ${mem.toFixed(0).padStart(5)} MB  cpu ${cpu.toFixed(1)}%`);
      }, ms - 300);
    }
    setTimeout(async () => {
      let img = await win.webContents.capturePage();
      for (let i = 0; i < 10 && img.isEmpty(); i++) {
        await new Promise((r) => setTimeout(r, 500));
        img = await win.webContents.capturePage();
      }
      const file = process.env.PHOSPHOR_SHOT;
      require('fs').writeFileSync(file, /\.jpe?g$/i.test(file) ? img.toJPEG(88) : img.toPNG());
      app.quit();
    }, Number(process.env.PHOSPHOR_SHOT_MS) || 4000);
  }
}

ipcMain.on('pty:start', (_e, size) => {
  if (!term) startPty(size.cols, size.rows);
});
ipcMain.on('pty:write', (_e, data) => {
  if (process.env.PHOSPHOR_SHOT && process.env.PHOSPHOR_LOGIN) console.log('[pty:write]', JSON.stringify(data));
  if (term) term.write(data);
});
// F12: save the CRT screen as a PNG in the Pictures folder.
ipcMain.on('shot:save', (_e, dataUrl) => {
  try {
    const fs = require('fs');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const file = path.join(app.getPath('pictures'), `phosphor-${stamp}.png`);
    fs.writeFileSync(file, Buffer.from(String(dataUrl).split(',')[1], 'base64'));
    if (win && !win.isDestroyed()) win.setTitle(`PHOSPHOR - saved ${path.basename(file)}`);
    setTimeout(() => win && !win.isDestroyed() && win.setTitle('PHOSPHOR'), 3000);
  } catch (err) {
    console.error('screenshot failed', err);
  }
});
ipcMain.on('pty:resize', (_e, size) => {
  try {
    if (term && size.cols > 0 && size.rows > 0) term.resize(size.cols, size.rows);
  } catch {}
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  try { term && term.kill(); } catch {}
  app.quit();
});
