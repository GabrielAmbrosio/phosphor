# PHOSPHOR

**A CRT terminal for Windows.** Simulated phosphor with persistence and burn-in, scanlines, tube curvature, ten skins, optional monitor frames, a boot sequence, synthesized sounds and a modem-speed mode. It runs PowerShell, or any command you give it, such as [Claude Code](https://claude.com/claude-code).

![Green P1 skin with the beige 80s frame](docs/img/skin-green-p1.jpg)

PHOSPHOR is a small Electron app: [xterm.js](https://xtermjs.org/) draws the terminal, [ConPTY](https://learn.microsoft.com/windows/console/creating-a-pseudoconsole-session) (through `@lydell/node-pty`) runs the shell, and a WebGL shader turns every frame into a glass tube. It is inspired by [cool-retro-term](https://github.com/Swordfish90/cool-retro-term), which has no Windows build.

## Skins

Each skin sets the phosphor color and every effect, and picks a monitor frame. Switch with **F10** or **Alt+Shift+Left/Right**.

| | |
|---|---|
| ![Atomic](docs/img/skin-atomic.jpg) **Atomic**: retro-futurist green, heavy scanlines, burn-in | ![Sepia](docs/img/skin-sepia.jpg) **Sepia**: warm, paper-like, gentle effects |
| ![Amber 80s](docs/img/skin-amber-80s.jpg) **Amber 80s**: classic amber monochrome | ![Cool Cyan](docs/img/skin-cool-cyan.jpg) **Cool Cyan**: cold cyan glow |
| ![IBM Blue](docs/img/skin-ibm-blue.jpg) **IBM Blue** | ![White P4](docs/img/skin-white-p4.jpg) **White P4** with the retro TV frame |

Also included: **Green P1** (default), **Claude** (orange), **Color** (keeps your terminal colors) and **Clean** (almost no effects).

## Features

- **Phosphor**: persistence (light fades slowly), burn-in (a faint ghost of what stayed on screen), glow, softness, glass glow, rounded glass corners and a power-on animation.
- **Tube**: curvature, scanlines, aperture mask, vignette, flicker, horizontal instability, refresh bar and a degauss wobble when you change skin.
- **Monitor frames** (optional): Beige 80s, Black and Retro TV, drawn in CSS with a power LED.
- **Boot sequence** (optional): a few lines of BIOS-style text. Any key skips it.
- **Sound** (optional, synthesized, no audio files): key clicks, CRT hum and power-on sweep.
- **Output speed**: throttle the terminal output like a slow serial line (300 to 19200 baud presets). A long backlog drains faster, so it never falls minutes behind.
- **Comfort mode**: removes flicker, jitter, noise bursts and flashes for long sessions.
- **Performance controls**: frame-rate cap and render quality (see below).
- Copy and paste (**Ctrl+C** copies when text is selected, **Ctrl+V** pastes), OSC 52 clipboard for applications, PNG export, fullscreen.
- Every setting is saved automatically.

## Run it

Requires Windows 10/11 and [Node.js](https://nodejs.org/) 18 or newer.

```powershell
git clone https://github.com/GabrielAmbrosio/phosphor.git
cd phosphor
npm install
npm start
```

- `npm start` opens PowerShell.
- `npm run claude` opens Claude Code (any command works: `npx electron . <command>`).
- Double-click `phosphor.cmd` or `phosphor-claude.cmd` for the same without a console window.
- `--phosphor-cwd=C:\some\folder` sets the starting directory.

### Build an installer

```powershell
npm run dist        # NSIS installer + portable exe in dist/
npm run dist:dir    # unpacked app in dist/win-unpacked
```

The app uses the default Electron icon until you add one (`build/icon.ico`).

## Controls

| Key | Action |
|---|---|
| **F10** | Settings panel: skins, frame, sliders, sound, speed |
| **F11** | Fullscreen |
| **F12** | Save the CRT screen as a PNG in your Pictures folder |
| **Alt+Shift+Left/Right** | Previous / next skin |
| **Ctrl+C / Ctrl+V** | Copy (with a selection) / paste |
| Any key | Skip the boot sequence |

## Performance

The screen only does work when it has to:

- A **frame-rate cap** (30 fps by default, 10 fps while the window is not focused).
- The terminal is copied to a GPU texture **only when it changed**; a static screen with no animated effect (for example the Clean skin) skips almost every frame.
- The **persistence** pass stops once the ghost has faded, and **burn-in** runs at 10 Hz and only while enabled.
- The shader uses **14 texture reads** per pixel.
- **Render quality** (100 / 75 / 50 %) trades sharpness for GPU time and memory.

Measured on Windows 11, Electron 33, 1100x720 window, idle terminal, total of all Electron processes (`PHOSPHOR_STATS=1`, numbers vary roughly 15 % between runs):

| Configuration | Frames drawn per second | Memory (all processes) |
|---|---|---|
| First version, no cap | about 100 | 550 to 740 MB |
| Default, 30 fps cap | about 28 | about 520 MB |
| Clean skin (nothing animated) | about 4 | about 490 MB |
| 50 % quality, window not focused | about 10 | about 440 MB |

About 270 MB of that is the Electron baseline (browser, utility and renderer processes); the GPU process is the part these settings change.

## How it works

1. xterm.js renders the terminal to 2D canvases that stay invisible but receive keyboard and mouse input.
2. When xterm reports a repaint, the canvases are composited and uploaded as a WebGL texture.
3. Pass 1 mixes the new frame with the previous one (persistence). Pass 2 keeps a very slow ghost (burn-in). Pass 3 draws the screen: curvature, glow, scanlines, mask, noise, vignette and rounded glass.
4. The monitor frame is plain CSS drawn on top.

Everything is in four files: [`main.js`](main.js) (window, pty), [`preload.js`](preload.js), [`renderer.js`](renderer.js) (terminal, shaders, panel) and [`index.html`](index.html).

## Tests and screenshots

- `npm run shots` regenerates the screenshots in `docs/img/`, one window per skin.
- Test mode: `PHOSPHOR_SHOT=out.png` saves a screenshot of the window and quits; `PHOSPHOR_STATS=1` prints memory and CPU per process; `--phosphor-fps=1` logs frames drawn and skipped.
- If you launch the app from another Electron program (for example VS Code's terminal), clear `ELECTRON_RUN_AS_NODE` first; the `.cmd` launchers already do.

## Credits

- Inspired by [cool-retro-term](https://github.com/Swordfish90/cool-retro-term) by Filippo Scognamiglio. PHOSPHOR does not use any of its code.
- Font: [VT323](https://fonts.google.com/specimen/VT323) by Peter Hull, under the SIL Open Font License (see [`fonts/OFL.txt`](fonts/OFL.txt)).
- Built with [Electron](https://www.electronjs.org/), [xterm.js](https://xtermjs.org/) and [node-pty](https://github.com/microsoft/node-pty).
- Not affiliated with any company whose software you may run inside it.

## License

[MIT](LICENSE)
