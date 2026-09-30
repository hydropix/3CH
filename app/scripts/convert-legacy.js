// Usage: node scripts/convert-legacy.js [legacyRoot] [outDir]
// Converts every legacy theme folder found under legacyRoot into JSON themes.

const fs = require('fs');
const path = require('path');
const { convertLegacyTheme, findLegacyThemes } = require('../src/legacy');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'Legacy'));
const outDir = path.resolve(process.argv[3] || path.join(__dirname, '..', 'themes'));

fs.mkdirSync(outDir, { recursive: true });

const seen = new Set();
for (const dir of findLegacyThemes(root)) {
  const theme = convertLegacyTheme(dir);
  if (seen.has(theme.id)) {
    console.warn(`skip duplicate theme "${theme.name}" (${dir})`);
    continue;
  }
  seen.add(theme.id);
  const file = path.join(outDir, `${theme.id}.json`);
  // Reworked themes (several structures, fixed spelling) are edited by hand:
  // only overwrite the ones this script produced.
  if (fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8')).source !== 'legacy') {
    console.log(`${theme.name.padEnd(18)} -> kept ${path.relative(process.cwd(), file)} (reworked by hand)`);
    continue;
  }
  fs.writeFileSync(file, JSON.stringify(theme, null, 2) + '\n', 'utf8');
  const sizes = Object.entries(theme.lists).map(([k, v]) => `${k}:${v.length}`);
  console.log(`${theme.name.padEnd(18)} -> ${path.relative(process.cwd(), file)}  [${sizes.join(' ')}]`);
}
