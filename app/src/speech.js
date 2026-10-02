// Text to WAV: the Piper voice shipped for the language (src/piper.js), else
// the voices the system already has: SAPI on Windows, `say` on macOS. The
// renderer turns the result into a robot.

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const piper = require('./piper');

const TIMEOUT_MS = 15000;

// One PowerShell process kept alive: starting it takes about a second, a
// sentence then takes 20-80 ms. Requests come in as "<lang> <base64 UTF-8>"
// lines, WAV files go out the same way; a line with the language alone only
// loads that voice. Each language gets the first enabled voice of its main
// culture (zh-CN before zh-HK or zh-TW), else of any culture of that language
// (Hortense for "fr", Zira or David for "en", Huihui for "zh"...), picked
// once, and the default voice when it has none: a French Windows would
// otherwise read English with Hortense. A voice of another script (Hortense
// reading Chinese) says nothing: the WAV comes back empty. Rate 2 (and 225 words a minute with `say`) talks
// about 1.3 times faster than normal.
const WINDOWS_ENGINE = `
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$fallback = $s.Voice.Name
$voices = @{}
$main = @{ en = 'en-US'; fr = 'fr-FR'; zh = 'zh-CN' }
function Use-Voice($lang) {
  if (-not $voices.ContainsKey($lang)) {
    $all = $s.GetInstalledVoices() | Where-Object { $_.Enabled }
    $v = $all | Where-Object { $_.VoiceInfo.Culture.Name -eq $main[$lang] } | Select-Object -First 1
    if (-not $v) { $v = $all | Where-Object { $_.VoiceInfo.Culture.Name -like "$lang*" } | Select-Object -First 1 }
    $voices[$lang] = if ($v) { $v.VoiceInfo.Name } else { $fallback }
  }
  if ($s.Voice.Name -ne $voices[$lang]) { $s.SelectVoice($voices[$lang]) }
}
$s.Rate = 2
$s.SetOutputToNull()
Use-Voice '__WARM__'
$s.Speak('ready')
while ($null -ne ($line = [Console]::In.ReadLine())) {
  try {
    $lang, $data = $line.Split(' ', 2)
    Use-Voice $lang
    if (-not $data) {
      $s.Speak('ready')
      [Console]::Out.WriteLine('ok')
      continue
    }
    $text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($data))
    $m = New-Object System.IO.MemoryStream
    $s.SetOutputToWaveStream($m)
    $s.Speak($text)
    $s.SetOutputToNull()
    [Console]::Out.WriteLine('ok ' + [Convert]::ToBase64String($m.ToArray()))
  } catch {
    $s.SetOutputToNull()
    [Console]::Out.WriteLine('err ' + $_.Exception.Message)
  }
}
`;

// "fr", "en"... anything else (or nothing) is English.
const langOf = (lang) => (/^[a-z]{2,3}$/.test(lang ?? '') ? lang : 'en');

let engine = null;

// The engine loads the voice of `lang` while it starts.
function startWindowsEngine(lang) {
  const script = WINDOWS_ENGINE.replace('__WARM__', langOf(lang));
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
    windowsHide: true,
  });
  const waiting = [];
  const fail = (err) => {
    if (engine?.child === child) engine = null;
    for (const w of waiting.splice(0)) w.reject(err);
  };
  let buffer = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    for (let end; (end = buffer.indexOf('\n')) >= 0; ) {
      const line = buffer.slice(0, end).trim();
      buffer = buffer.slice(end + 1);
      const w = waiting.shift();
      if (!w) continue;
      if (line === 'ok' || line.startsWith('ok ')) w.resolve(Buffer.from(line.slice(3), 'base64'));
      else w.reject(new Error(line.replace(/^err /, '') || 'speech failed'));
    }
  });
  child.stderr.resume();
  child.on('error', fail);
  child.on('exit', () => fail(new Error('the speech engine stopped')));
  // Without `text`, only loads the voice (the answer is an empty buffer).
  return {
    child,
    warm: new Set([langOf(lang)]),
    ask: (lang, text) =>
      new Promise((resolve, reject) => {
        waiting.push({ resolve, reject });
        const data = text === undefined ? '' : ' ' + Buffer.from(text, 'utf8').toString('base64');
        child.stdin.write(langOf(lang) + data + '\n');
      }),
  };
}

function withTimeout(promise, onTimeout) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        onTimeout();
        reject(new Error('the speech engine did not answer'));
      }, TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}

function run(command, args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim().split('\n')[0] || `${command} exited with ${code}`));
    });
    if (input !== undefined) child.stdin.end(input);
  });
}

// `say -v ?` lists "Name   fr_FR   # sample". Each language takes a preferred
// voice when it is installed, else the first one of its main locale, else of
// any of its locales, else the default voice (null).
const MAC_PREFERRED = {
  en: ['Samantha', 'Alex', 'Daniel', 'Fred'],
  fr: ['Thomas', 'Amélie', 'Audrey', 'Aurélie', 'Marie'],
  zh: ['Tingting', 'Ting-Ting', 'Lili', 'Yu-shu'],
};
const MAC_MAIN = { en: 'US', fr: 'FR', zh: 'CN' };
let macList = null;
const macVoices = new Map();
async function pickMacVoice(lang) {
  if (macVoices.has(lang)) return macVoices.get(lang);
  macList ??= run('say', ['-v', '?']).catch(() => '');
  const voices = (await macList)
    .split('\n')
    .map((line) => line.match(/^(.+?)\s+([a-z]{2,3})[_-](\w+)\s+#/))
    .filter((m) => m && m[2] === lang);
  const names = voices.map((m) => m[1].trim());
  const main = voices.find((m) => m[3] === MAC_MAIN[lang]);
  const voice = (MAC_PREFERRED[lang] ?? []).find((v) => names.includes(v)) ?? main?.[1].trim() ?? names[0] ?? null;
  macVoices.set(lang, voice);
  return voice;
}

// Piper first; a voice that fails is dropped for the session and the system
// voice takes over.
async function render(text, lang) {
  if (piper.available(lang)) {
    try {
      return await piper.render(text, lang);
    } catch (err) {
      console.warn(`Piper voice for "${lang}" failed, falling back to the system voice:`, err.message);
    }
  }
  return renderSystem(text, lang);
}

async function renderSystem(text, lang) {
  if (process.platform === 'win32') {
    engine ??= startWindowsEngine(lang);
    const { child, ask } = engine;
    return withTimeout(ask(lang, text), () => child.kill());
  }
  if (process.platform === 'darwin') {
    const out = path.join(os.tmpdir(), `3ch-speech-${process.pid}-${Date.now()}.wav`);
    try {
      const voice = await pickMacVoice(lang);
      const args = ['-r', '225', '--file-format=WAVE', '--data-format=LEI16@22050', '-o', out, '-f', '-'];
      await run('say', voice ? ['-v', voice, ...args] : args, { input: text });
      return fs.readFileSync(out);
    } finally {
      fs.rm(out, { force: true }, () => {});
    }
  }
  throw new Error('speech is only available on Windows and macOS');
}

// One sentence at a time. Subjects (`latest`) keep only the newest one in the
// queue, so rolling fast never builds up a backlog: a subject overtaken by a
// newer one resolves to null. Timer lines all wait their turn. `lang` picks
// the voice ("en", "fr"...).
let busy = false;
const queue = [];

function synthesize(text, { latest = true, lang = 'en' } = {}) {
  return new Promise((resolve, reject) => {
    if (latest) {
      const old = queue.findIndex((job) => job.latest);
      if (old >= 0) queue.splice(old, 1)[0].resolve(null);
    }
    queue.push({ text, latest, lang: langOf(lang), resolve, reject });
    pump();
  });
}

async function pump() {
  if (busy || !queue.length) return;
  const job = queue.shift();
  busy = true;
  try {
    job.resolve(await render(job.text, job.lang));
  } catch (err) {
    job.reject(err);
  } finally {
    busy = false;
    pump();
  }
}

// Loads the Piper voice of `lang` ahead of the first sentence, or, without
// one, starts the Windows engine and loads the system voice of `lang` once
// per engine.
function warmUp(lang) {
  lang = langOf(lang);
  if (piper.available(lang)) return void piper.load(lang).catch(() => {});
  if (process.platform !== 'win32') return;
  if (!engine) return void (engine = startWindowsEngine(lang));
  if (engine.warm.has(lang)) return;
  engine.warm.add(lang);
  const { child, ask } = engine;
  withTimeout(ask(lang), () => child.kill()).catch(() => {});
}

function stop() {
  engine?.child.kill();
  engine = null;
}

module.exports = { synthesize, warmUp, stop };
