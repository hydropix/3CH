const test = require('node:test');
const assert = require('node:assert');
const { parseWav, robotize } = require('../renderer/voice');

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wav16(samples, sampleRate, channels = 1) {
  const b = Buffer.alloc(46 + samples.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(b.length - 8, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(18, 16); // SAPI writes an 18-byte fmt chunk
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(channels, 22);
  b.writeUInt32LE(sampleRate, 24);
  b.writeUInt32LE(sampleRate * 2 * channels, 28);
  b.writeUInt16LE(2 * channels, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 38);
  b.writeUInt32LE(samples.length * 2, 42);
  samples.forEach((v, i) => b.writeInt16LE(v, 46 + i * 2));
  return new Uint8Array(b);
}

// A buzzy vowel with a moving formant, enough to feed the vocoder.
function fakeSpeech(sampleRate, seconds) {
  const x = new Float32Array(Math.round(sampleRate * seconds));
  for (let i = 0; i < x.length; i++) {
    const t = i / sampleRate;
    x[i] = 0.5 * Math.sin(2 * Math.PI * 140 * t) * Math.sin(2 * Math.PI * (500 + 300 * Math.sin(3 * t)) * t);
  }
  return x;
}

test('reads 16-bit WAV files, mixing stereo down to mono', () => {
  const mono = parseWav(wav16([0, 16384, -32768], 22050));
  assert.strictEqual(mono.sampleRate, 22050);
  assert.deepStrictEqual(Array.from(mono.samples), [0, 0.5, -1]);

  const stereo = parseWav(wav16([16384, 0, -16384, -16384], 44100, 2));
  assert.deepStrictEqual(Array.from(stereo.samples), [0.25, -0.5]);

  assert.throws(() => parseWav(new Uint8Array(20)), /not a WAV/);
});

test('robotizes speech into a safe, finite, glitched signal', () => {
  const sampleRate = 22050;
  const input = fakeSpeech(sampleRate, 2);
  const out = robotize(input, sampleRate, seeded(7));

  assert.ok(out.every(Number.isFinite));
  assert.ok(out.every((v) => Math.abs(v) <= 0.9 + 1e-6));
  assert.ok(Math.max(...out.map(Math.abs)) > 0.5, 'not silent');
  assert.ok(out.length > input.length * 0.5 && out.length < input.length * 2);
});

test('the same seed breaks the voice the same way, another seed differently', () => {
  const input = fakeSpeech(16000, 1);
  const a = robotize(input, 16000, seeded(1));
  assert.deepStrictEqual(robotize(input, 16000, seeded(1)), a);
  assert.notDeepStrictEqual(robotize(input, 16000, seeded(2)), a);
});

test('silence stays silent', () => {
  assert.strictEqual(robotize(new Float32Array(22050), 22050, seeded(3)).length, 0);
});
