// Piper voices (VITS models run by sherpa-onnx), shipped with the app: one
// voice per language, rendered in this process. speech.js falls back to the
// system voice when the addon, the voice or its loading fails.

const fs = require('fs');
const os = require('os');
const path = require('path');

// The voices `npm run voices` fetches into app/voices and the builds ship.
// Each is the "vits-piper-<name>" archive of sherpa-onnx's tts-models
// release, its files renamed "<name>.<file>". The English and French ones
// phonemize with espeak-ng (one shared espeak-ng-data); the Chinese one reads
// characters through its own lexicon.txt, with FSTs that spell out numbers,
// dates and phone numbers. Licences are those of the datasets.
const VOICES = {
  en: 'en_US-ljspeech-medium', // LJ Speech, public domain
  fr: 'fr_FR-siwis-medium', // SIWIS, CC BY 4.0
  zh: 'zh_CN-chaowen-medium', // CC0
};
// The espeak-ng dictionaries the voices above need (the rest is dropped).
const DICTS = ['en', 'fr'];
// Extra files a voice may come with, copied by `npm run voices`.
const EXTRAS = ['lexicon.txt', 'phone.fst', 'date.fst', 'number.fst'];
// SAPI at rate 2 talks about 1.3 times faster than normal: keep that pace.
const SPEED = 1.25;
// 4 threads render a sentence in about 100 ms; more barely helps.
const THREADS = Math.max(1, Math.min(4, os.cpus().length - 1));

// Packaged: resources/voices. In development: app/voices.
const DIR = [process.resourcesPath && path.join(process.resourcesPath, 'voices'), path.join(__dirname, '..', 'voices')].find(
  (dir) => dir && fs.existsSync(dir)
);

let sherpa; // undefined until tried, null when the addon does not load
function addon() {
  if (sherpa === undefined) {
    try {
      sherpa = require('sherpa-onnx-node');
    } catch {
      sherpa = null;
    }
  }
  return sherpa;
}

const loaded = new Map(); // lang -> Promise<OfflineTts>
const broken = new Set(); // languages whose voice failed to load

// The sherpa-onnx config of a voice, or null when a file is missing: given a
// missing file, sherpa-onnx exits the whole process instead of failing.
function config(lang) {
  const name = VOICES[lang];
  if (!name || !DIR) return null;
  const at = (file) => path.join(DIR, `${name}.${file}`);
  const vits = { model: at('onnx'), tokens: at('tokens.txt') };
  if (fs.existsSync(at('lexicon.txt'))) vits.lexicon = at('lexicon.txt');
  else vits.dataDir = path.join(DIR, 'espeak-ng-data');
  if (!Object.values(vits).every((file) => fs.existsSync(file))) return null;
  const ruleFsts = EXTRAS.filter((file) => file.endsWith('.fst')).map(at).filter((file) => fs.existsSync(file));
  return {
    model: { vits, numThreads: THREADS, provider: 'cpu', debug: 0 },
    ruleFsts: ruleFsts.join(','),
    maxNumSentences: 1,
  };
}

function available(lang) {
  return !broken.has(lang) && Boolean(config(lang)) && Boolean(addon());
}

// Loads the voice of `lang` once (about a second), in the background.
function load(lang) {
  if (!loaded.has(lang)) {
    const voice = addon()
      .OfflineTts.createAsync(config(lang))
      .catch((err) => {
        broken.add(lang);
        loaded.delete(lang);
        throw err;
      });
    loaded.set(lang, voice);
  }
  return loaded.get(lang);
}

// 16-bit PCM mono, what the renderer's Voice.parseWav reads.
function toWav(samples, sampleRate) {
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + samples.length * 2, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(1, 22); // mono
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  }
  return wav;
}

// Electron forbids external buffers: the samples must be copied out.
async function render(text, lang) {
  const tts = await load(lang);
  const { samples, sampleRate } = await tts.generateAsync({ text, sid: 0, speed: SPEED, enableExternalBuffer: false });
  return toWav(samples, sampleRate);
}

module.exports = { VOICES, DICTS, EXTRAS, available, load, render, toWav };
