const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, Menu, Notification, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const { loadThemes } = require('./src/themes');
const { convertLegacyTheme, findLegacyThemes } = require('./src/legacy');

const bundledThemesDir = path.join(__dirname, 'themes');
const userThemesDir = () => path.join(app.getPath('userData'), 'themes');

let win;
let normalBounds = null;

const NORMAL_MIN = [900, 620];
const MINI_SIZE = { width: 560, height: 210 };

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: NORMAL_MIN[0],
    minHeight: NORMAL_MIN[1],
    title: '3CH',
    backgroundColor: '#070608',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // The speed painting timer must stay exact while the window is hidden.
      backgroundThrottling: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.on('focus', () => win.flashFrame(false));
  // Windows can drop the topmost flag (another app going fullscreen or
  // topmost): keep the mini window above while mini mode is on.
  const keepOnTop = () => {
    if (normalBounds && !win.isAlwaysOnTop()) win.setAlwaysOnTop(true, 'floating');
  };
  win.on('always-on-top-changed', keepOnTop);
  win.on('blur', keepOnTop);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // The app never browses: keep every navigation inside the bundled page.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

ipcMain.handle('themes:list', () => loadThemes(bundledThemesDir, userThemesDir()));

ipcMain.handle('themes:importLegacy', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Import a legacy 3CH theme folder',
    properties: ['openDirectory'],
  });
  if (canceled || !filePaths.length) return { imported: [], errors: [] };

  const imported = [];
  const errors = [];
  let skipped = 0;
  try {
    const dirs = findLegacyThemes(filePaths[0], { onSkip: () => skipped++ });
    if (!dirs.length) errors.push('No folder with a structure.txt was found.');
    if (skipped) errors.push(`Skipped ${skipped} unreadable folder${skipped > 1 ? 's' : ''}.`);
    if (dirs.length) fs.mkdirSync(userThemesDir(), { recursive: true });
    for (const dir of dirs) {
      try {
        const theme = convertLegacyTheme(dir);
        theme.source = 'legacy-import';
        fs.writeFileSync(
          path.join(userThemesDir(), `${theme.id}.json`),
          JSON.stringify(theme, null, 2) + '\n',
          'utf8'
        );
        imported.push(theme.id);
      } catch (err) {
        errors.push(err.message);
      }
    }
  } catch (err) {
    errors.push(`Import failed: ${err.message}`);
  }
  return { imported, errors };
});

ipcMain.handle('themes:openFolder', () => {
  fs.mkdirSync(userThemesDir(), { recursive: true });
  return shell.openPath(userThemesDir());
});

ipcMain.handle('export:text', async (_e, content, defaultName) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export selected subjects',
    defaultPath: defaultName,
    filters: [{ name: 'Text', extensions: ['txt'] }],
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, String(content), 'utf8');
  return filePath;
});

// Timer: taskbar progress (value in 0..1, or -1 to clear) and end-of-session alert.
ipcMain.on('timer:progress', (_e, value, mode) => {
  if (!win) return;
  win.setProgressBar(Number(value), { mode: mode === 'paused' ? 'paused' : 'normal' });
});

ipcMain.on('timer:done', (_e, body) => {
  if (!win) return;
  win.setProgressBar(-1);
  if (win.isFocused()) return;
  win.flashFrame(true);
  if (Notification.isSupported()) {
    const n = new Notification({ title: "Time's up", body: String(body || ''), silent: true });
    n.on('click', () => {
      if (win.isMinimized()) win.restore();
      win.focus();
    });
    n.show();
  }
});

// Mini mode: a small always-on-top window to keep the subject and the timer
// in sight while painting in another app.
ipcMain.handle('window:mini', (_e, on) => {
  if (!win) return false;
  if (on && !normalBounds) {
    if (win.isMaximized()) win.unmaximize();
    normalBounds = win.getBounds();
    const area = screen.getDisplayMatching(normalBounds).workArea;
    win.setMinimumSize(380, 150);
    win.setBounds({
      x: area.x + area.width - MINI_SIZE.width - 24,
      y: area.y + 24,
      ...MINI_SIZE,
    });
    win.setAlwaysOnTop(true, 'floating');
  } else if (!on && normalBounds) {
    const bounds = normalBounds;
    normalBounds = null;
    win.setAlwaysOnTop(false);
    win.setMinimumSize(...NORMAL_MIN);
    win.setBounds(bounds);
  }
  return Boolean(normalBounds);
});

ipcMain.handle('clipboard:write', (_e, content) => clipboard.writeText(String(content)));

app.setAppUserModelId('com.hydropix.3ch');

// macOS takes Cmd+Q, Cmd+W and copy/paste from the menu roles: keep a minimal
// menu there. Windows and Linux get no menu bar at all.
function setMenu() {
  if (process.platform !== 'darwin') return Menu.setApplicationMenu(null);
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'fileMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }])
  );
}

app.whenReady().then(() => {
  setMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
