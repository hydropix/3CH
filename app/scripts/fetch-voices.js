// Fetches the Piper voices of src/piper.js into app/voices (git-ignored), from
// sherpa-onnx's tts-models release. The builds ship that folder. Voices already
// there are kept; `--force` fetches them again.
//
//   npm run voices

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { VOICES, DICTS, EXTRAS } = require('../src/piper');

const RELEASE = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models';
const OUT = path.join(__dirname, '..', 'voices');
const force = process.argv.includes('--force');

// Windows' own tar (bsdtar) reads bz2; Git Bash's GNU tar may come first in
// the PATH. The archive is passed relative to `cwd`, since GNU tar reads
// "C:..." as a remote host.
const TAR = process.platform === 'win32' ? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar';

// Keeps the files every language needs and only the dictionaries of DICTS
// (18 MB down to about 1 MB: ru_dict alone is 8 MB).
function copyEspeak(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, {
    recursive: true,
    filter: (src) => {
      const dict = path.basename(src).match(/^(.+)_dict$/);
      return !dict || DICTS.includes(dict[1]);
    },
  });
}

async function fetchVoice(name, tmp) {
  const url = `${RELEASE}/vits-piper-${name}.tar.bz2`;
  process.stdout.write(`${name}: downloading... `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const archive = 'voice.tar.bz2';
  fs.writeFileSync(path.join(tmp, archive), Buffer.from(await res.arrayBuffer()));
  process.stdout.write('extracting... ');
  const tar = spawnSync(TAR, ['-xjf', archive], { cwd: tmp, stdio: 'inherit' });
  if (tar.status !== 0) throw new Error(`tar failed on ${url}`);

  const dir = path.join(tmp, `vits-piper-${name}`);
  fs.copyFileSync(path.join(dir, `${name}.onnx`), path.join(OUT, `${name}.onnx`));
  fs.copyFileSync(path.join(dir, 'tokens.txt'), path.join(OUT, `${name}.tokens.txt`));
  fs.copyFileSync(path.join(dir, 'MODEL_CARD'), path.join(OUT, `${name}.MODEL_CARD.txt`));
  for (const file of EXTRAS) {
    if (fs.existsSync(path.join(dir, file))) fs.copyFileSync(path.join(dir, file), path.join(OUT, `${name}.${file}`));
  }
  if (!fs.existsSync(path.join(OUT, 'espeak-ng-data'))) copyEspeak(path.join(dir, 'espeak-ng-data'), path.join(OUT, 'espeak-ng-data'));
  console.log(`${(fs.statSync(path.join(OUT, `${name}.onnx`)).size / 2 ** 20).toFixed(0)} MB`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  if (force) fs.rmSync(path.join(OUT, 'espeak-ng-data'), { recursive: true, force: true });
  for (const name of Object.values(VOICES)) {
    if (!force && fs.existsSync(path.join(OUT, `${name}.onnx`))) {
      console.log(`${name}: already there`);
      continue;
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '3ch-voice-'));
    try {
      await fetchVoice(name, tmp);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
  // The voices are there but espeak-ng-data was deleted: --force rebuilds it.
  if (!fs.existsSync(path.join(OUT, 'espeak-ng-data'))) throw new Error('espeak-ng-data is missing: run with --force');
})().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
