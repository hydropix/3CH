// Text to WAV with the voices the system already has: SAPI on Windows, `say`
// on macOS. The renderer turns the result into a robot.

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TIMEOUT_MS = 15000;

// One PowerShell process kept alive: starting it takes about a second, a
// sentence then takes 20-80 ms. Requests come in as base64 UTF-8 lines, WAV
// files go out the same way. An English voice when there is one: the
// subjects are English, and a French Windows speaks with Hortense by default.
// Rate 2 (and 225 words a minute with `say`) talks about 1.3 times faster than normal.
const WINDOWS_ENGINE = `
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$v = $s.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'en*' } | Select-Object -First 1
if ($v) { $s.SelectVoice($v.VoiceInfo.Name) }
$s.Rate = 2
$s.SetOutputToNull()
$s.Speak('ready')
while ($null -ne ($line = [Console]::In.ReadLine())) {
  try {
    $text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($line))
    $m = New-Object System.IO.MemoryStream
    $s.SetOutputToWaveStream($m)
    $s.Speak($text)
    $s.SetOutputToNull()
    [Console]::Out.WriteLine('ok ' + [Convert]::ToBase64String($m.ToArray()))
  } catch {
    [Console]::Out.WriteLine('err ' + $_.Exception.Message)
  }
}
`;

let engine = null;

function startWindowsEngine() {
  const encoded = Buffer.from(WINDOWS_ENGINE, 'utf16le').toString('base64');
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
      if (line.startsWith('ok ')) w.resolve(Buffer.from(line.slice(3), 'base64'));
      else w.reject(new Error(line.replace(/^err /, '') || 'speech failed'));
    }
  });
  child.stderr.resume();
  child.on('error', fail);
  child.on('exit', () => fail(new Error('the speech engine stopped')));
  return {
    child,
    ask: (text) =>
      new Promise((resolve, reject) => {
        waiting.push({ resolve, reject });
        child.stdin.write(Buffer.from(text, 'utf8').toString('base64') + '\n');
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

let macVoice;
async function pickMacVoice() {
  if (macVoice !== undefined) return macVoice;
  const list = await run('say', ['-v', '?']).catch(() => '');
  const english = list
    .split('\n')
    .map((line) => line.match(/^(.+?)\s+(en[_-]\w+)\s+#/))
    .filter(Boolean)
    .map((m) => m[1].trim());
  const preferred = ['Samantha', 'Alex', 'Daniel', 'Fred'];
  macVoice = preferred.find((v) => english.includes(v)) ?? english[0] ?? null;
  return macVoice;
}

async function render(text) {
  if (process.platform === 'win32') {
    engine ??= startWindowsEngine();
    const { child, ask } = engine;
    return withTimeout(ask(text), () => child.kill());
  }
  if (process.platform === 'darwin') {
    const out = path.join(os.tmpdir(), `3ch-speech-${process.pid}-${Date.now()}.wav`);
    try {
      const voice = await pickMacVoice();
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
// newer one resolves to null. Timer lines all wait their turn.
let busy = false;
const queue = [];

function synthesize(text, { latest = true } = {}) {
  return new Promise((resolve, reject) => {
    if (latest) {
      const old = queue.findIndex((job) => job.latest);
      if (old >= 0) queue.splice(old, 1)[0].resolve(null);
    }
    queue.push({ text, latest, resolve, reject });
    pump();
  });
}

async function pump() {
  if (busy || !queue.length) return;
  const job = queue.shift();
  busy = true;
  try {
    job.resolve(await render(job.text));
  } catch (err) {
    job.reject(err);
  } finally {
    busy = false;
    pump();
  }
}

// Starts the Windows engine ahead of the first sentence.
function warmUp() {
  if (process.platform === 'win32') engine ??= startWindowsEngine();
}

function stop() {
  engine?.child.kill();
  engine = null;
}

module.exports = { synthesize, warmUp, stop };
