const test = require('node:test');
const assert = require('node:assert');
const { parseList } = require('../src/legacy');

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
