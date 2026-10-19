// PHOSPHOR: xterm.js (2D canvas) -> WebGL texture -> CRT shader with phosphor persistence and burn-in.
(() => {
  'use strict';

  const OPTS = (window.pty && window.pty.opts) || {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- Skins and settings ----------
  const COMMON = {
    curv: 0.2, scan: 0.45, bloom: 0.4, soft: 0.04, persist: 0.55, burn: 0, base: 0.03,
    noise: 0.012, flicker: 0.02, jitter: 0.08, vig: 0.4, bright: 1.45, font: 26,
    mono: 1, tint: [0.7, 0.95, 0.3], bezel: 'none', bootId: 'classic',
    // user preferences that a skin never overrides
    boot: 1, keySound: 0, hum: 0, speed: 0, comfort: 0, fps: 30, scale: 1,
  };
  const PREFS = ['boot', 'keySound', 'hum', 'speed', 'comfort', 'fps', 'scale', 'font'];
  const SKIN_DEFS = {
    'Green P1':  { tint: [0.70, 0.95, 0.30], soft: 0.05, bloom: 0.45, base: 0.04, bezel: 'beige' },
    'Atomic':    { tint: [0.30, 1.00, 0.35], scan: 0.62, bloom: 0.6, soft: 0.04, persist: 0.62, flicker: 0.04, jitter: 0.15,
                   curv: 0.26, vig: 0.55, noise: 0.02, bright: 1.55, burn: 0.35, bezel: 'dark', bootId: 'atomic' },
    'Sepia':     { tint: [0.92, 0.70, 0.44], scan: 0.25, bloom: 0.3, soft: 0.08, persist: 0.2, noise: 0.015, flicker: 0.01,
                   jitter: 0.04, curv: 0.12, vig: 0.45, bright: 1.3, base: 0.05, bezel: 'beige', bootId: 'sepia' },
    'Amber 80s': { tint: [1.00, 0.58, 0.10], soft: 0.05, bloom: 0.45, base: 0.05, burn: 0.2, bezel: 'beige' },
    'Cool Cyan': { tint: [0.45, 0.85, 1.00], soft: 0.1, bloom: 0.55, scan: 0.5, base: 0.07, curv: 0.24, bezel: 'dark' },
    'White P4':  { tint: [0.85, 0.95, 1.00], persist: 0.35, bezel: 'tv' },
    'IBM Blue':  { tint: [0.35, 0.65, 1.00], bezel: 'dark' },
    'Claude':    { tint: [1.00, 0.45, 0.25], persist: 0.5, soft: 0.05 },
    'Color':     { mono: 0, tint: [1, 1, 1], bloom: 0.3, soft: 0.03, base: 0 },
    'Clean':     { mono: 0, tint: [1, 1, 1], curv: 0.05, scan: 0.12, bloom: 0.15, soft: 0, persist: 0, noise: 0, flicker: 0,
                   jitter: 0, vig: 0.15, bright: 1, base: 0 },
  };
  const SKINS = {};
  for (const [name, d] of Object.entries(SKIN_DEFS)) SKINS[name] = { ...COMMON, ...d, skin: name };

  const BEZELS = {
    none:  { label: 'None',        t: 0,  r: 0,  b: 0,  l: 0,  rad: 0 },
    beige: { label: 'Beige 80s',   t: 22, r: 22, b: 58, l: 22, rad: 34 },
    dark:  { label: 'Black',       t: 16, r: 16, b: 42, l: 16, rad: 22 },
    tv:    { label: 'Retro TV',    t: 34, r: 34, b: 74, l: 34, rad: 90 },
  };

  const BOOT = {
    classic: ['PHOSPHOR TERMINAL  v1.0', '', 'MEMORY TEST ........ 640K OK', 'DISPLAY ............. OK', 'KEYBOARD ............ OK', '', 'READY.'],
    atomic: ['PHOSPHOR TERMLINK UNIFIED OS  v75.0.8', 'COPYRIGHT 2075-2077 PHOSPHOR SYSTEMS', '-SERVER 1-', '', '> INITIALIZING DISPLAY CORE', '> RADIATION SHIELD ..... OK', '> LOADING SHELL ........ OK', '', 'WELCOME, USER.'],
    sepia: ['PHOSPHOR  -  Archive Terminal', 'Reading documents ...', '', 'Ready.'],
  };

  const SLIDERS = [
    { sec: 'Screen' },
    { k: 'curv',    label: 'Curvature',      min: 0,   max: 0.5,  step: 0.01 },
    { k: 'scan',    label: 'Scanlines',      min: 0,   max: 1,    step: 0.01 },
    { k: 'bloom',   label: 'Glow',           min: 0,   max: 1.5,  step: 0.01 },
    { k: 'soft',    label: 'Softness',       min: 0,   max: 1,    step: 0.01 },
    { k: 'persist', label: 'Persistence',    min: 0,   max: 0.95, step: 0.01 },
    { k: 'burn',    label: 'Burn-in',        min: 0,   max: 1,    step: 0.01 },
    { k: 'base',    label: 'Glass glow',     min: 0,   max: 0.15, step: 0.005 },
    { k: 'noise',   label: 'Noise',          min: 0,   max: 0.2,  step: 0.005 },
    { k: 'flicker', label: 'Flicker',        min: 0,   max: 0.15, step: 0.005 },
    { k: 'jitter',  label: 'Instability',    min: 0,   max: 1,    step: 0.01 },
    { k: 'vig',     label: 'Vignette',       min: 0,   max: 1,    step: 0.01 },
    { k: 'bright',  label: 'Brightness',     min: 0.5, max: 2,    step: 0.01 },
    { k: 'font',    label: 'Font size',      min: 12,  max: 40,   step: 1 },
    { sec: 'Sound' },
    { k: 'keySound', label: 'Key clicks',    min: 0,   max: 1,    step: 0.05, fmt: (v) => (v ? v : 'off') },
    { k: 'hum',      label: 'CRT hum',       min: 0,   max: 1,    step: 0.05, fmt: (v) => (v ? v : 'off') },
    { sec: 'Typing' },
    { k: 'speed',   label: 'Output speed',   min: 0,   max: 2000, step: 10, fmt: (v) => (v ? `${v} chars/s` : 'instant') },
  ];

  let cfg = { ...SKINS['Green P1'] };
  if (!OPTS.fresh) {
    try {
      const saved = JSON.parse(localStorage.getItem('phosphor') || 'null');
      if (saved) cfg = { ...cfg, ...saved };
    } catch {}
  }
  if (OPTS.skin && SKINS[OPTS.skin]) cfg = { ...SKINS[OPTS.skin] };
  if (OPTS.fpscap) cfg.fps = Number(OPTS.fpscap);   // test overrides
  if (OPTS.scale) cfg.scale = Number(OPTS.scale);
  if (!BEZELS[cfg.bezel]) cfg.bezel = 'none';
  const save = () => { try { localStorage.setItem('phosphor', JSON.stringify(cfg)); } catch {} };

  // ---------- Terminal ----------
  const FONT = "VT323, 'Cascadia Mono', Consolas, 'MS Gothic', 'Segoe UI Symbol', monospace";
  const term = new Terminal({
    fontFamily: FONT,
    fontSize: cfg.font,
    cursorBlink: true,
    cursorStyle: 'block',
    allowProposedApi: true,
    scrollback: 5000,
    theme: { background: '#000000', foreground: '#d8d8d8', cursor: '#ffffff', selectionBackground: '#555555' },
  });
  const fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  const termEl = document.getElementById('term');
  term.open(termEl);
  term.loadAddon(new CanvasAddon.CanvasAddon());
  term.loadAddon(new ClipboardAddon.ClipboardAddon()); // lets applications copy through OSC 52
  term.options.scrollback = 3000;

  function doFit() {
    try { fit.fit(); } catch {}
  }
  // The pty always follows the real terminal size (initial fit, window resize, font size).
  term.onResize(({ cols, rows }) => window.pty.resize({ cols, rows }));
  new ResizeObserver(doFit).observe(termEl);

  // ---------- Sound (synthesized, no audio files) ----------
  const audio = { ctx: null, noise: null, humGain: null };
  function actx() {
    if (!audio.ctx) {
      try {
        audio.ctx = new AudioContext();
        const n = audio.ctx.createBuffer(1, Math.floor(audio.ctx.sampleRate * 0.06), audio.ctx.sampleRate);
        const d = n.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        audio.noise = n;
      } catch {}
    }
    if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
    return audio.ctx;
  }
  const soundOn = () => cfg.keySound > 0 || cfg.hum > 0;

  function keyClick(d) {
    if (!cfg.keySound) return;
    const c = actx();
    if (!c) return;
    const t = c.currentTime;
    const v = cfg.keySound;
    const big = d === '\r' || d === ' ';
    const src = c.createBufferSource();
    src.buffer = audio.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = (big ? 900 : 1800) + Math.random() * 900;
    bp.Q.value = 1.1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 0.06 : 0.035));
    src.connect(bp).connect(g).connect(c.destination);
    src.start(t);
    const o = c.createOscillator();
    o.frequency.value = big ? 90 : 140;
    const og = c.createGain();
    og.gain.setValueAtTime(0.25 * v, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    o.connect(og).connect(c.destination);
    o.start(t);
    o.stop(t + 0.05);
  }

  function updateHum() {
    if (!cfg.hum) {
      if (audio.humGain) audio.humGain.gain.value = 0;
      return;
    }
    const c = actx();
    if (!c) return;
    if (!audio.humGain) {
      audio.humGain = c.createGain();
      audio.humGain.connect(c.destination);
      for (const [f, a] of [[50, 0.5], [100, 0.25], [15734, 0.05]]) {
        const o = c.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        const g = c.createGain();
        g.gain.value = a;
        o.connect(g).connect(audio.humGain);
        o.start();
      }
    }
    audio.humGain.gain.value = 0.06 * cfg.hum;
  }

  function sweep(from, to, dur, peak) {
    if (!soundOn()) return;
    const c = actx();
    if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.6);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  const powerOnSound = () => sweep(40, 15000, 0.9, 0.05 * Math.max(cfg.hum, 0.4));
  const degaussSound = () => sweep(70, 25, 0.9, 0.2 * Math.max(cfg.keySound, cfg.hum, 0.3));

  // ---------- Input / output ----------
  let bootActive = false;
  let bootSkip = false;
  let hold = false;       // output held back (boot sequence)
  let queue = '';         // pty output waiting to be written (typing speed)
  let carry = 0;

  term.onData((d) => {
    if (bootActive) { bootSkip = true; return; }
    keyClick(d);
    window.pty.write(d);
  });
  window.pty.onData((d) => { queue += d; });

  // Writes pending pty output. With a speed limit it behaves like a slow line; a long backlog
  // drains faster (up to ~0.5 s of delay) so it never falls minutes behind.
  function drain(dt) {
    if (hold || !queue) return;
    if (!cfg.speed) {
      term.write(queue);
      queue = '';
      carry = 0;
      return;
    }
    carry += Math.max(cfg.speed, queue.length * 2) * dt;
    let n = Math.floor(carry);
    if (n <= 0) return;
    carry -= n;
    if (n > queue.length) n = queue.length;
    const code = queue.charCodeAt(n - 1);
    if (code >= 0xd800 && code <= 0xdbff && n < queue.length) n++; // keep surrogate pairs together
    term.write(queue.slice(0, n));
    queue = queue.slice(n);
  }

  async function runBoot() {
    const lines = BOOT[cfg.bootId] || BOOT.classic;
    bootActive = true;
    bootSkip = false;
    hold = true;
    powerOnSound();
    term.write('\x1b[2J\x1b[H');
    for (const line of lines) {
      for (const ch of line) {
        if (bootSkip) break;
        term.write(ch);
        await sleep(7);
      }
      if (bootSkip) break;
      term.write('\r\n');
      await sleep(90);
    }
    if (!bootSkip) await sleep(450);
    term.write('\x1b[2J\x1b[H\x1b[3J');
    bootActive = false;
    hold = false;
  }

  // Copy / paste like a regular terminal.
  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== 'keydown') return true;
    if (e.key === 'F10' || e.key === 'F12' || (e.altKey && e.shiftKey && e.key.startsWith('Arrow'))) return false; // handled by the window listener
    const ctrl = e.ctrlKey && !e.altKey;
    if (ctrl && e.key.toLowerCase() === 'c' && (term.hasSelection() || e.shiftKey)) {
      navigator.clipboard.writeText(term.getSelection());
      term.clearSelection();
      return false;
    }
    if (ctrl && e.key.toLowerCase() === 'v') {
      navigator.clipboard.readText().then((t) => term.paste(t));
      return false;
    }
    return true;
  });
  termEl.addEventListener('mousedown', () => term.focus());

  // ---------- WebGL ----------
  const canvas = document.getElementById('gl');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
  if (!gl) {
    document.getElementById('wrap').style.opacity = 1;
    return;
  }

  const VS = `attribute vec2 p; varying vec2 v;
    void main(){ v = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;

  // Pass 1: phosphor persistence (new light mixes with the previous frame, which fades slowly).
  const FS_PERSIST = `precision mediump float; varying vec2 v;
    uniform sampler2D uCur, uPrev; uniform float uDecay;
    void main(){
      vec3 c = texture2D(uCur, v).rgb;
      vec3 p = texture2D(uPrev, v).rgb;
      gl_FragColor = vec4(max(c, p*uDecay - 0.004), 1.);
    }`;

  // Pass 2: burn-in. Dim ghost of what stayed on screen; fades through random 1/255 steps (8-bit safe).
  const FS_BURN = `precision highp float; varying vec2 v;
    uniform sampler2D uCur, uPrev; uniform float uK, uRate, uTime; uniform vec2 uRes;
    float rnd(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(uCur, v).rgb * uK;
      vec3 p = texture2D(uPrev, v).rgb;
      p -= (rnd(v*uRes + fract(uTime)) < uRate) ? 1./255. : 0.;
      gl_FragColor = vec4(max(max(p, 0.), c), 1.);
    }`;

  // Pass 3: the screen (curvature, glow, softness, scanlines, mask, noise, vignette, rounded glass).
  const FS_SCREEN = `precision highp float; varying vec2 v;
    uniform sampler2D uTex, uBurn; uniform vec2 uRes; uniform float uTime, uDpr, uPower, uDeg;
    uniform float uCurv, uScan, uBloom, uSoft, uBase, uNoise, uFlicker, uJitter, uVig, uBright, uMono;
    uniform vec3 uTint;
    float rnd(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 cc = v*2.-1.;
      // Power-on: a line that opens up.
      float pw = clamp(uPower,0.,1.);
      float w = mix(0.015, 1., smoothstep(0.0, .45, pw));
      float h = mix(0.002, 1., smoothstep(.40, 1., pw));
      cc /= vec2(w, h);
      // Tube curvature.
      vec2 off = abs(cc.yx) * uCurv;
      cc += cc * off * off;
      vec2 uv = cc*.5+.5;
      if (uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.){ gl_FragColor = vec4(0.,0.,0.,1.); return; }
      // Rounded glass corners.
      vec2 dd = abs(uv-.5)*2.;
      vec2 qq = dd - (1.-.1);
      float sdf = length(max(qq,0.)) - .1;
      float glass = 1. - smoothstep(-.02, .015, sdf);
      // Horizontal instability, refresh bar, degauss wobble.
      float bar = smoothstep(.05, 0., abs(fract(uv.y*.9 - uTime*.07) - .5) - .45);
      uv.x += uJitter * (0.0006*(rnd(vec2(floor(uTime*24.), floor(uv.y*uRes.y/2.)))-.5)
                         + 0.0012*sin(uv.y*40. + uTime*3.) * bar);
      uv.x += uDeg * 0.03 * sin(uv.y*18. + uTime*45.);
      vec2 px = 1./uRes;
      vec3 col = texture2D(uTex, uv).rgb;
      col = max(col, texture2D(uBurn, uv).rgb);
      // Softness (glyph blur) and glow: rings of taps.
      // 14 texture reads in total: 4 for softness, 4 + 4 for the two glow rings, 2 for the center.
      vec2 e = px * uDpr;
      vec3 sm = texture2D(uTex, uv + vec2( 1.4, 0.)*e).rgb + texture2D(uTex, uv + vec2(-1.4, 0.)*e).rgb
              + texture2D(uTex, uv + vec2(0.,  1.4)*e).rgb + texture2D(uTex, uv + vec2(0., -1.4)*e).rgb;
      vec3 g = texture2D(uTex, uv + vec2( 3.5,  3.5)*e).rgb + texture2D(uTex, uv + vec2(-3.5,  3.5)*e).rgb
             + texture2D(uTex, uv + vec2( 3.5, -3.5)*e).rgb + texture2D(uTex, uv + vec2(-3.5, -3.5)*e).rgb
             + (texture2D(uTex, uv + vec2( 7., 0.)*e).rgb + texture2D(uTex, uv + vec2(-7., 0.)*e).rgb
              + texture2D(uTex, uv + vec2(0.,  7.)*e).rgb + texture2D(uTex, uv + vec2(0., -7.)*e).rgb) * .6;
      col = mix(col, sm*.25, uSoft*.6);
      col += g/6.4 * uBloom;
      // Monochrome phosphor: tinted luminance.
      float l = dot(col, vec3(.299,.587,.114));
      vec3 mono = uTint * l * 1.25;
      col = mix(col, mono, uMono);
      // Lit glass: the screen is never pure black.
      col += uTint * uBase * mix(.5, 1., uMono);
      // Scanlines and aperture mask.
      float s = .5 + .5*sin(uv.y*uRes.y/(3.*uDpr)*6.28318);
      col *= 1. - uScan*(1.-s)*.9;
      float m = fract(uv.x*uRes.x/(3.*uDpr));
      col *= vec3(.97+.06*step(m,.33), .97+.06*step(.33,m)*step(m,.66), .97+.06*step(.66,m));
      // Noise and flicker.
      col += (rnd(uv*uRes + uTime) - .5) * uNoise;
      col *= 1. + uFlicker*sin(uTime*50.) + .02*bar*step(.001, uJitter);
      // Vignette and glass reflection.
      vec2 q = uv*(1.-uv.yx);
      col *= mix(1., pow(clamp(q.x*q.y*16., 0., 1.), .5), uVig);
      col += vec3(.035) * smoothstep(.8, .0, distance(uv, vec2(.25,.8))) * (uMono*.6+.4);
      col += uDeg * .12 * vec3(sin(uv.y*20.), sin(uv.y*20.+2.), sin(uv.y*20.+4.));
      col *= uBright * (1. + (1.-pw)*2.5);
      gl_FragColor = vec4(clamp(col, 0., 1.) * glass, 1.);
    }`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
    return { p, u };
  }
  const persistP = program(FS_PERSIST);
  const burnP = program(FS_BURN);
  const screenP = program(FS_SCREEN);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function makeTex() {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  const makeFbo = () => ({ tex: makeTex(), fb: gl.createFramebuffer() });
  const texCur = makeTex();
  const pers = [makeFbo(), makeFbo()];
  const burn = [makeFbo(), makeFbo()];
  let pi = 0;
  let bi = 0;

  const off = document.createElement('canvas');
  const octx = off.getContext('2d', { alpha: false });
  let W = 0;
  let H = 0;
  let dpr = 1; // effective pixels per CSS pixel: device pixel ratio x render scale
  let dirty = true; // the terminal changed since the last texture upload
  let lastDirty = 0;

  function resize() {
    dpr = (window.devicePixelRatio || 1) * (cfg.scale || 1);
    const r = canvas.getBoundingClientRect();
    W = Math.max(2, Math.floor(r.width * dpr));
    H = Math.max(2, Math.floor(r.height * dpr));
    dirty = true;
    canvas.width = off.width = W;
    canvas.height = off.height = H;
    for (const f of [...pers, ...burn]) {
      gl.bindTexture(gl.TEXTURE_2D, f.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, f.fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, f.tex, 0);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    doFit();
  }
  new ResizeObserver(resize).observe(canvas);
  term.onRender(() => { dirty = true; });
  // Moving the window to a screen with another scale factor changes devicePixelRatio without resizing it.
  (function watchDpr() {
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener('change', () => { resize(); watchDpr(); }, { once: true });
  })();

  function grabTerminal() {
    octx.fillStyle = '#000';
    octx.fillRect(0, 0, W, H);
    const origin = canvas.getBoundingClientRect();
    for (const c of termEl.querySelectorAll('.xterm-screen canvas')) {
      const cr = c.getBoundingClientRect();
      octx.drawImage(c, (cr.left - origin.left) * dpr, (cr.top - origin.top) * dpr, cr.width * dpr, cr.height * dpr);
    }
  }

  function bindPass(fbo, a, b) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo ? fbo.fb : null);
    gl.viewport(0, 0, W, H);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, a);
    if (b) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, b); }
  }

  let deg = 0; // degauss pulse (1 -> 0)
  const t0 = performance.now();
  let last = t0;
  let lastDraw = 0;
  let burnTick = 0;
  let burnLive = false;       // burn textures may hold a ghost image
  let shotWanted = false;     // F12: export the screen as PNG after the next draw
  // --phosphor-fps=1 logs frames per second, CPU time per drawn frame and skipped frames.
  const perf = { frames: 0, busy: 0, since: t0, skipped: 0 };

  // Effective effect strengths (Comfort mode removes everything that moves or flashes).
  const eff = () => {
    const k = cfg.comfort ? 0 : 1;
    return { flicker: cfg.flicker * k, jitter: cfg.jitter * k, noise: cfg.noise * (cfg.comfort ? 0.3 : 1) };
  };

  function frame(now) {
    requestAnimationFrame(frame);
    const f0 = performance.now();
    const cap = document.hasFocus() ? cfg.fps || 30 : 10;       // unfocused window: 10 fps
    if (now - lastDraw < 1000 / cap - 2) return;                 // frame-rate cap
    lastDraw = now;
    const drew = draw(now);
    if (OPTS.fps) {
      if (drew) { perf.frames++; perf.busy += performance.now() - f0; } else perf.skipped++;
      if (now - perf.since >= 2000) {
        const s = (now - perf.since) / 1000;
        console.log(`drawn ${(perf.frames / s).toFixed(1)}/s  skipped ${(perf.skipped / s).toFixed(1)}/s  cpu per drawn frame ${(perf.busy / Math.max(1, perf.frames)).toFixed(2)} ms`);
        perf.frames = 0; perf.busy = 0; perf.skipped = 0; perf.since = now;
      }
    }
  }

  // Returns false when nothing needed to be drawn (static image, no animated effect).
  function draw(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const time = (now - t0) / 1000;
    deg = Math.max(0, deg - dt * 1.4);
    drain(dt);

    const e = eff();
    const power = Math.min(1, time / 0.9);
    const persistOn = cfg.persist >= 0.02;
    // After the last change the persistence ghost needs a moment to fade out.
    const ghostMs = persistOn ? (Math.log(0.004) / Math.log(cfg.persist) / 60) * 1000 + 150 : 0;
    const ghosting = persistOn && now - lastDirty < ghostMs;
    const animated = e.flicker > 0 || e.jitter > 0 || e.noise > 0 || deg > 0 || power < 1;
    if (!dirty && !ghosting && !animated && !shotWanted && !(cfg.burn > 0 && now - burnTick > 100)) return false;

    // Only re-upload the terminal when it actually changed (xterm tells us through onRender).
    if (dirty) {
      grabTerminal();
      gl.bindTexture(gl.TEXTURE_2D, texCur);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
      lastDirty = now;
    }

    // Pass 1: persistence (skipped when off or fully faded: the last result is the settled image).
    let sceneTex = texCur;
    if (persistOn) {
      if (dirty || ghosting) {
        const pSrc = pers[pi];
        const pDst = pers[1 - pi];
        bindPass(pDst, texCur, pSrc.tex);
        gl.useProgram(persistP.p);
        gl.uniform1i(persistP.u.uCur, 0);
        gl.uniform1i(persistP.u.uPrev, 1);
        gl.uniform1f(persistP.u.uDecay, Math.pow(cfg.persist, dt * 60));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        pi = 1 - pi;
      }
      sceneTex = pers[pi].tex;
    }

    // Pass 2: burn-in, only while enabled and at 10 Hz (its fade is very slow); cleared once when turned off.
    if (cfg.burn > 0) {
      if (now - burnTick > 100) {
        burnTick = now;
        const bSrc = burn[bi];
        const bDst = burn[1 - bi];
        bindPass(bDst, texCur, bSrc.tex);
        gl.useProgram(burnP.p);
        gl.uniform1i(burnP.u.uCur, 0);
        gl.uniform1i(burnP.u.uPrev, 1);
        gl.uniform1f(burnP.u.uK, cfg.burn * 0.3);
        gl.uniform1f(burnP.u.uRate, 0.018);
        gl.uniform1f(burnP.u.uTime, time);
        gl.uniform2f(burnP.u.uRes, W, H);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        bi = 1 - bi;
        burnLive = true;
      }
    } else if (burnLive) {
      for (const f of burn) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, f.fb);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      burnLive = false;
    }

    // Pass 3: screen.
    bindPass(null, sceneTex, burn[bi].tex);
    gl.useProgram(screenP.p);
    const u = screenP.u;
    gl.uniform1i(u.uTex, 0);
    gl.uniform1i(u.uBurn, 1);
    gl.uniform2f(u.uRes, W, H);
    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uDpr, dpr);
    gl.uniform1f(u.uPower, power);
    gl.uniform1f(u.uDeg, cfg.comfort ? 0 : deg);
    gl.uniform1f(u.uCurv, cfg.curv);
    gl.uniform1f(u.uScan, cfg.scan);
    gl.uniform1f(u.uBloom, cfg.bloom);
    gl.uniform1f(u.uSoft, cfg.soft);
    gl.uniform1f(u.uBase, cfg.base);
    gl.uniform1f(u.uNoise, e.noise);
    gl.uniform1f(u.uFlicker, e.flicker);
    gl.uniform1f(u.uJitter, e.jitter);
    gl.uniform1f(u.uVig, cfg.vig);
    gl.uniform1f(u.uBright, cfg.bright);
    gl.uniform1f(u.uMono, cfg.mono);
    gl.uniform3fv(u.uTint, cfg.tint);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (shotWanted) {
      shotWanted = false;
      window.pty.saveShot(canvas.toDataURL('image/png'));
    }
    dirty = false;
    return true;
  }

  // ---------- Bezel ----------
  function applyBezel() {
    const b = BEZELS[cfg.bezel] || BEZELS.none;
    const s = document.documentElement.style;
    s.setProperty('--bz-t', `${b.t}px`);
    s.setProperty('--bz-r', `${b.r}px`);
    s.setProperty('--bz-b', `${b.b}px`);
    s.setProperty('--bz-l', `${b.l}px`);
    s.setProperty('--bz-rad', `${b.rad}px`);
    document.documentElement.setAttribute('data-bezel', cfg.bezel);
  }

  // ---------- Settings panel (F10) ----------
  const panel = document.getElementById('panel');
  function applyFont() {
    term.options.fontSize = cfg.font;
    doFit();
  }
  function applySkin(name) {
    const keep = {};
    for (const k of PREFS) keep[k] = cfg[k];
    cfg = { ...SKINS[name], ...keep };
    save();
    applyBezel();
    dirty = true;
    deg = 1;
    degaussSound();
    buildPanel();
    term.focus();
  }

  function buildPanel() {
    panel.innerHTML = '<h1>PHOSPHOR</h1>';
    const sect = (t) => { const h = document.createElement('h2'); h.textContent = t; panel.appendChild(h); };
    const buttons = (items, isOn, onPick) => {
      const row = document.createElement('div');
      row.className = 'row';
      for (const [id, label] of items) {
        const b = document.createElement('button');
        b.textContent = label;
        if (isOn(id)) b.className = 'on';
        b.onclick = () => onPick(id);
        row.appendChild(b);
      }
      panel.appendChild(row);
    };

    sect('Skins');
    buttons(Object.keys(SKINS).map((n) => [n, n]), (n) => cfg.skin === n, applySkin);

    sect('Monitor frame');
    buttons(Object.entries(BEZELS).map(([id, b]) => [id, b.label]), (id) => cfg.bezel === id, (id) => {
      cfg.bezel = id; save(); applyBezel(); buildPanel(); term.focus();
    });

    const check = (label, key) => {
      const lab = document.createElement('label');
      lab.className = 'check';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!cfg[key];
      cb.onchange = () => { cfg[key] = cb.checked ? 1 : 0; save(); dirty = true; };
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(label));
      panel.appendChild(lab);
    };
    sect('Options');
    check('Boot sequence', 'boot');
    check('Comfort mode (no flicker, jitter or flashes)', 'comfort');

    sect('Performance');
    const hint = (t) => { const d = document.createElement('div'); d.className = 'hint'; d.style.margin = '4px 0'; d.textContent = t; panel.appendChild(d); };
    hint('Frame rate (10 fps while the window is not focused)');
    buttons([[60, '60 fps'], [30, '30 fps'], [15, '15 fps']], (v) => cfg.fps === v, (v) => { cfg.fps = v; save(); buildPanel(); });
    hint('Render quality (lower = less GPU and memory)');
    buttons([[1, '100%'], [0.75, '75%'], [0.5, '50%']], (v) => cfg.scale === v, (v) => { cfg.scale = v; save(); resize(); buildPanel(); });

    for (const s of SLIDERS) {
      if (s.sec) { sect(s.sec); continue; }
      const fmt = s.fmt || ((v) => v);
      const l = document.createElement('label');
      const val = document.createElement('span');
      val.textContent = fmt(cfg[s.k]);
      l.textContent = s.label;
      l.appendChild(val);
      const r = document.createElement('input');
      r.type = 'range'; r.min = s.min; r.max = s.max; r.step = s.step; r.value = cfg[s.k];
      r.oninput = () => {
        cfg[s.k] = parseFloat(r.value);
        val.textContent = fmt(cfg[s.k]);
        save();
        dirty = true;
        if (s.k === 'font') applyFont();
        if (s.k === 'hum') updateHum();
      };
      panel.appendChild(l);
      panel.appendChild(r);
    }
    hint('Modem presets (baud / 10 = chars per second)');
    buttons([[0, 'Instant'], [30, '300'], [120, '1200'], [960, '9600'], [1920, '19200']], (v) => cfg.speed === v, (v) => {
      cfg.speed = v; save(); buildPanel();
    });
    const h = document.createElement('div');
    h.className = 'hint';
    h.innerHTML = 'F10 panel &middot; F11 fullscreen &middot; F12 save PNG &middot; Alt+Shift+Left/Right switch skin<br>Ctrl+C copies when text is selected, Ctrl+V pastes. Any key skips the boot sequence.';
    panel.appendChild(h);
  }
  function togglePanel() {
    const open = panel.style.display !== 'block';
    panel.style.display = open ? 'block' : 'none';
    if (open) buildPanel(); else term.focus();
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F10') { togglePanel(); e.preventDefault(); }
    if (e.key === 'F12') { shotWanted = true; e.preventDefault(); }
    if (e.key === 'Escape' && panel.style.display === 'block') togglePanel();
    if (e.altKey && e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const names = Object.keys(SKINS);
      const i = Math.max(0, names.indexOf(cfg.skin));
      applySkin(names[(i + (e.key === 'ArrowRight' ? 1 : names.length - 1)) % names.length]);
      e.preventDefault();
    }
  });

  // ---------- Startup ----------
  const start = () => {
    applyBezel();
    hold = cfg.boot && OPTS.boot !== '0'; // hold output before the pty starts talking
    resize();
    window.pty.start({ cols: term.cols, rows: term.rows });
    setTimeout(doFit, 150);
    setTimeout(doFit, 600);
    term.focus();
    updateHum();
    requestAnimationFrame(frame);
    if (hold) runBoot();
  };
  document.fonts.load(`${cfg.font}px VT323`).catch(() => {}).finally(start);
})();
