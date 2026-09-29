const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadThemes } = require('../src/themes');

test('an invalid user theme is reported without hiding the others', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '3ch-themes-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const good = { structure: ['a'], lists: { a: ['x'] } };
  fs.writeFileSync(path.join(dir, 'good.json'), JSON.stringify(good));
  fs.writeFileSync(path.join(dir, 'bad-name.json'), JSON.stringify({ ...good, name: 3 }));
  fs.writeFileSync(path.join(dir, 'broken.json'), '{ not json');

  const { themes, errors } = loadThemes(path.join(__dirname, '..', 'themes'), dir);
  assert.ok(themes.some((th) => th.id === 'good' && th.origin === 'user'));
  assert.ok(themes.some((th) => th.id === 'darwin' && th.origin === 'bundled'));
  assert.strictEqual(errors.length, 2, errors.join('\n'));
});
