// Renders build/icon.png (1024x1024, transparent) from the app's dice mark.
// electron-builder derives the Windows .ico and macOS .icns from it.
// Usage: npx electron scripts/make-icon.js

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const SIZE = 1024;
// macOS icon grid: the body covers ~80% of the canvas.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffb766"/>
      <stop offset="1" stop-color="#e08a2e"/>
    </linearGradient>
  </defs>
  <rect x="100" y="100" width="824" height="824" rx="190" fill="url(#g)"/>
  <g fill="#1a1206">
    <circle cx="332" cy="332" r="72"/><circle cx="692" cy="332" r="72"/>
    <circle cx="512" cy="512" r="72"/>
    <circle cx="332" cy="692" r="72"/><circle cx="692" cy="692" r="72"/>
  </g>
</svg>`;

app.disableHardwareAcceleration();
app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: true },
  });
  win.webContents.setFrameRate(1);
  win.webContents.once('paint', (_e, _dirty, image) => {
    const out = path.join(__dirname, '..', 'build', 'icon.png');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, image.resize({ width: SIZE, height: SIZE }).toPNG());
    console.log(`wrote ${out}`);
    app.quit();
  });
  const html = `<html><body style="margin:0;background:transparent">${svg}</body></html>`;
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
});
