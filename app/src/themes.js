// Loads JSON themes from the bundled folder and the user's themes folder.
// A user theme with the same id overrides the bundled one.

const fs = require('fs');
const path = require('path');
const { validateTheme } = require('../renderer/generator');

function readThemeDir(dir, origin) {
  if (!fs.existsSync(dir)) return { themes: [], errors: [] };
  const themes = [];
  const errors = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.json'))) {
    const full = path.join(dir, file);
    try {
      const theme = JSON.parse(fs.readFileSync(full, 'utf8'));
      const problem = validateTheme(theme);
      if (problem) throw new Error(problem);
      theme.id = theme.id || path.basename(file, '.json');
      theme.name = theme.name || theme.id;
      themes.push({ ...theme, origin, file: full });
    } catch (err) {
      errors.push(`${file}: ${err.message}`);
    }
  }
  return { themes, errors };
}

function loadThemes(bundledDir, userDir) {
  const bundled = readThemeDir(bundledDir, 'bundled');
  const user = readThemeDir(userDir, 'user');
  const byId = new Map();
  for (const t of [...bundled.themes, ...user.themes]) byId.set(t.id, t);
  const themes = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { themes, errors: [...bundled.errors, ...user.errors] };
}

module.exports = { loadThemes };
