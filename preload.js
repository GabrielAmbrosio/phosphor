const { contextBridge, ipcRenderer } = require('electron');

// Opciones de arranque: --phosphor-skin=Nombre --phosphor-boot=0 --phosphor-fresh=1 (las usa tools/make-shots.js)
const opts = {};
for (const a of process.argv) {
  const m = /^--phosphor-([a-z]+)=(.*)$/.exec(a);
  if (m) opts[m[1]] = m[2];
}

contextBridge.exposeInMainWorld('pty', {
  opts,
  start: (size) => ipcRenderer.send('pty:start', size),
  write: (data) => ipcRenderer.send('pty:write', data),
  resize: (size) => ipcRenderer.send('pty:resize', size),
  saveShot: (dataUrl) => ipcRenderer.send('shot:save', dataUrl),
  onData: (cb) => ipcRenderer.on('pty:data', (_e, d) => cb(d)),
});
