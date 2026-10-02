const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { VOICES, toWav } = require('../src/piper');
const { parseWav } = require('../renderer/voice');

test('a Piper recording reads back as the samples it was made of', () => {
  const samples = Float32Array.from({ length: 300 }, (_, i) => Math.sin(i / 7) * 0.5);
  samples[10] = 2; // clipped, not wrapped
  const back = parseWav(toWav(samples, 22050));
  assert.strictEqual(back.sampleRate, 22050);
  assert.strictEqual(back.samples.length, samples.length);
  assert.ok(Math.abs(back.samples[10] - 1) < 1e-3);
  for (let i = 0; i < 300; i += 37) assert.ok(Math.abs(back.samples[i] - samples[i]) < 1e-4, `sample ${i}`);
});

test('every bundled theme language has a Piper voice', () => {
  const dir = path.join(__dirname, '..', 'themes');
  const langs = new Set(fs.readdirSync(dir).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).lang ?? 'en'));
  for (const lang of langs) assert.ok(VOICES[lang], `no voice for "${lang}"`);
});
