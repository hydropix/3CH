const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { parseList, findLegacyThemes } = require('../src/legacy');

test('splits entries missing their comma or using a semicolon', () => {
  assert.deepStrictEqual(parseList('in a pool \non a highway,\nguy with a shotgun;\nsexy woman,'), [
    'in a pool',
    'on a highway',
    'guy with a shotgun',
    'sexy woman',
  ]);
});

test('drops accidental empties, keeps intentional ones as a weight', () => {
  assert.deepStrictEqual(parseList('child, ,\nsnake, '), ['child', 'snake']);
  assert.deepStrictEqual(parseList('very,\n,\n,\n,\nquite'), ['very', { text: '', weight: 3 }, 'quite']);
});

test('duplicates become weights and stray brackets are cleaned', () => {
  assert.deepStrictEqual(parseList('herbivorous,\nherbivorous,\n(  (in black and white),'), [
    { text: 'herbivorous', weight: 2 },
    '(in black and white)',
  ]);
});

test('finds the legacy themes, skips unreadable folders and stops at the depth limit', () => {
  const legacy = path.join(__dirname, '..', '..', 'Legacy');
  assert.strictEqual(findLegacyThemes(legacy).length, 5);
  assert.strictEqual(findLegacyThemes(legacy, { maxDepth: 1 }).length, 0);

  const skipped = [];
  const missing = path.join(legacy, 'no-such-folder');
  assert.deepStrictEqual(findLegacyThemes(missing, { onSkip: (dir) => skipped.push(dir) }), []);
  assert.deepStrictEqual(skipped, [missing]);
});
