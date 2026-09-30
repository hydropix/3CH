// Robot voice: turns a plain text-to-speech recording into a broken machine
// (channel vocoder on a stepped sawtooth, then random glitches).
// Pure DSP on Float32Array samples, shared by the renderer and the Node tests.
(function (root) {
  'use strict';

  // Reads a RIFF/WAVE file (16-bit PCM or 32-bit float) into mono samples.
  function parseWav(bytes) {
    const buf = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const view = new DataView(buf);
    const tag = (at) => String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));
    if (view.byteLength < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a WAV file');

    let fmt = null;
    let data = null;
    for (let at = 12; at + 8 <= view.byteLength; ) {
      const size = view.getUint32(at + 4, true);
      const body = at + 8;
      if (tag(at) === 'fmt ') {
        fmt = {
          format: view.getUint16(body, true),
          channels: view.getUint16(body + 2, true),
          sampleRate: view.getUint32(body + 4, true),
          bits: view.getUint16(body + 14, true),
        };
      } else if (tag(at) === 'data') {
        data = { at: body, size: Math.min(size, view.byteLength - body) };
      }
      at = body + size + (size % 2);
    }
    if (!fmt || !data) throw new Error('WAV file without fmt or data');

    const pcm16 = fmt.format === 1 && fmt.bits === 16;
    const float32 = fmt.format === 3 && fmt.bits === 32;
    if (!pcm16 && !float32) throw new Error(`unsupported WAV format (${fmt.format}, ${fmt.bits} bits)`);
    const width = fmt.bits / 8;
    const frames = Math.floor(data.size / (width * fmt.channels));
    const samples = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      let sum = 0;
      for (let c = 0; c < fmt.channels; c++) {
        const at = data.at + (i * fmt.channels + c) * width;
        sum += pcm16 ? view.getInt16(at, true) / 32768 : view.getFloat32(at, true);
      }
      samples[i] = sum / fmt.channels;
    }
    return { samples, sampleRate: fmt.sampleRate };
  }

  // ---------- Building blocks ----------

  function peak(x) {
    let p = 0;
    for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i]));
    return p;
  }

  function normalize(x, target = 1) {
    const p = peak(x);
    if (p > 1e-6) for (let i = 0; i < x.length; i++) x[i] *= target / p;
    return x;
  }

  // Drops the silence the speech engines leave around the words.
  function trim(x, sampleRate, threshold = 0.01) {
    let start = 0;
    let end = x.length;
    while (start < end && Math.abs(x[start]) < threshold) start++;
    while (end > start && Math.abs(x[end - 1]) < threshold) end--;
    const pad = Math.round(sampleRate * 0.02);
    return x.slice(Math.max(0, start - pad), Math.min(x.length, end + pad));
  }

  function fade(x, length) {
    const n = Math.min(length, Math.floor(x.length / 2));
    for (let i = 0; i < n; i++) {
      const g = i / n;
      x[i] *= g;
      x[x.length - 1 - i] *= g;
    }
    return x;
  }

  function concat(chunks) {
    const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
    let at = 0;
    for (const c of chunks) {
      out.set(c, at);
      at += c.length;
    }
    return out;
  }

  // RBJ band-pass, 0 dB peak, run twice for a steeper band.
  function bandpass(x, freq, q, sampleRate) {
    const w = (2 * Math.PI * freq) / sampleRate;
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    const b0 = alpha / a0;
    const a1 = (-2 * Math.cos(w)) / a0;
    const a2 = (1 - alpha) / a0;
    const out = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    let z1 = 0, z2 = 0;
    for (let i = 0; i < x.length; i++) {
      const y = b0 * (x[i] - x2) - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x[i];
      // Second pass, fed by the first: its input history is y1, y2.
      const z = b0 * (y - y2) - a1 * z1 - a2 * z2;
      y2 = y1;
      y1 = y;
      z2 = z1;
      z1 = z;
      out[i] = z;
    }
    return out;
  }

  // Envelope follower: fast attack, slower release.
  function envelope(x, sampleRate) {
    const attack = Math.exp(-1 / (0.004 * sampleRate));
    const release = Math.exp(-1 / (0.03 * sampleRate));
    const out = new Float32Array(x.length);
    let e = 0;
    for (let i = 0; i < x.length; i++) {
      const v = Math.abs(x[i]);
      e = v > e ? attack * e + (1 - attack) * v : release * e + (1 - release) * v;
      out[i] = e;
    }
    return out;
  }

  // A few notes around the base pitch, so the robot "sings" off key.
  const STEPS = [0, 0, 0, 0, -2, 3, 5, -5, 7, -7, 12];

  // Sawtooth whose pitch jumps (and sometimes slides) every 80-340 ms.
  function carrier(length, sampleRate, rand) {
    const saw = new Float32Array(length);
    const base = 75 + rand() * 45;
    const note = () => base * 2 ** (STEPS[Math.floor(rand() * STEPS.length)] / 12);
    let phase = 0;
    let i = 0;
    let from = note();
    while (i < length) {
      const n = Math.min(length - i, Math.round(sampleRate * (0.08 + rand() * 0.26)));
      const to = note();
      const slide = rand() < 0.18;
      for (let k = 0; k < n; k++, i++) {
        const f = slide ? from + ((to - from) * k) / n : to;
        phase += f / sampleRate;
        phase -= Math.floor(phase);
        saw[i] = 2 * phase - 1;
      }
      from = to;
    }
    return saw;
  }

  // Channel vocoder: the speech's spectral envelope, played by a sawtooth
  // (plus noise in the top bands so that s, t and f survive). A bit of the
  // ring-modulated original is mixed back in for intelligibility.
  function vocode(x, sampleRate, rand) {
    const saw = carrier(x.length, sampleRate, rand);
    const low = new Float32Array(x.length);
    const high = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) {
      const noise = rand() * 2 - 1;
      low[i] = saw[i] + 0.05 * noise;
      high[i] = saw[i] + 0.7 * noise;
    }

    const bands = 20;
    const lo = 130;
    const hi = Math.min(7000, sampleRate * 0.45);
    const out = new Float32Array(x.length);
    for (let b = 0; b < bands; b++) {
      const f = lo * (hi / lo) ** (b / (bands - 1));
      const env = envelope(bandpass(x, f, 5, sampleRate), sampleRate);
      const car = bandpass(f > 2800 ? high : low, f, 5, sampleRate);
      for (let i = 0; i < out.length; i++) out[i] += car[i] * env[i];
    }
    normalize(out);

    const ring = 40 + rand() * 30;
    const dry = normalize(Float32Array.from(x));
    for (let i = 0; i < out.length; i++) {
      out[i] += 0.3 * dry[i] * Math.sin((2 * Math.PI * ring * i) / sampleRate);
    }
    return out;
  }

  // ---------- Glitches ----------

  // "d-d-d-devours": the head of the segment, repeated.
  function stutter(seg, sampleRate, rand) {
    const head = fade(seg.slice(0, Math.round(sampleRate * (0.025 + rand() * 0.05))), 20);
    const times = 2 + Math.floor(rand() * 4);
    return concat([...Array(times).fill(head), seg]);
  }

  // A tiny grain stuck in a loop, like a frozen buffer.
  function freeze(seg, sampleRate, rand) {
    const grain = seg.slice(0, Math.round(sampleRate * (0.006 + rand() * 0.012)));
    const out = new Float32Array(Math.round(sampleRate * (0.08 + rand() * 0.16)));
    for (let i = 0; i < out.length; i++) out[i] = grain[i % grain.length] || 0;
    return concat([out, seg]);
  }

  // Fewer bits and a lower sample rate.
  function crush(seg, rand) {
    const levels = 2 ** (2 + Math.floor(rand() * 3));
    const hold = 2 + Math.floor(rand() * 8);
    const out = new Float32Array(seg.length);
    let v = 0;
    for (let i = 0; i < seg.length; i++) {
      if (i % hold === 0) v = Math.round(seg[i] * levels) / levels;
      out[i] = v;
    }
    return out;
  }

  // Plays the segment faster or slower: higher or lower pitch.
  function resample(seg, speed) {
    const out = new Float32Array(Math.max(1, Math.floor(seg.length / speed)));
    for (let i = 0; i < out.length; i++) {
      const at = i * speed;
      const k = Math.floor(at);
      const t = at - k;
      out[i] = (seg[k] || 0) * (1 - t) + (seg[k + 1] || 0) * t;
    }
    return out;
  }

  // Signal lost: a gap, sometimes filled with a burst of digital noise.
  function dropout(seg, sampleRate, rand) {
    const out = Float32Array.from(seg);
    const gap = Math.min(out.length, Math.round(sampleRate * (0.02 + rand() * 0.05)));
    const at = Math.floor(rand() * (out.length - gap + 1));
    const burst = rand() < 0.5 ? 0.25 : 0;
    for (let i = at; i < at + gap; i++) out[i] = burst * (rand() < 0.5 ? -1 : 1);
    return out;
  }

  function clip(seg) {
    return seg.map((v) => Math.max(-0.35, Math.min(0.35, v * 4)));
  }

  // The machine running out of power.
  function tapeStop(x, sampleRate) {
    const n = Math.min(x.length, Math.round(sampleRate * 0.35));
    const head = x.slice(0, x.length - n);
    const tail = x.slice(x.length - n);
    const out = [];
    for (let at = 0, speed = 1; at < tail.length - 1 && speed > 0.15; speed -= 0.7 / sampleRate / 0.35) {
      const k = Math.floor(at);
      const t = at - k;
      out.push(tail[k] * (1 - t) + tail[k + 1] * t);
      at += speed;
    }
    return concat([head, Float32Array.from(out)]);
  }

  // Cuts the sound into 50-270 ms segments and breaks about a third of them.
  function glitch(x, sampleRate, rand) {
    const chunks = [];
    for (let i = 0; i < x.length; ) {
      const len = Math.min(x.length - i, Math.round(sampleRate * (0.05 + rand() * 0.22)));
      let seg = x.slice(i, i + len);
      i += len;
      const r = rand();
      if (r < 0.1) seg = stutter(seg, sampleRate, rand);
      else if (r < 0.15) seg = freeze(seg, sampleRate, rand);
      else if (r < 0.22) seg = crush(seg, rand);
      else if (r < 0.26) seg = seg.reverse();
      else if (r < 0.32) seg = resample(seg, rand() < 0.5 ? 0.6 : 1.7);
      else if (r < 0.36) seg = dropout(seg, sampleRate, rand);
      else if (r < 0.39) seg = clip(seg);
      chunks.push(seg);
    }
    const out = concat(chunks);
    return rand() < 0.3 ? tapeStop(out, sampleRate) : out;
  }

  // Soft clipping for grit, then a safe level.
  function finish(x, sampleRate) {
    for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * 1.8);
    return fade(normalize(x, 0.9), Math.round(sampleRate * 0.005));
  }

  function robotize(samples, sampleRate, rand = Math.random) {
    const speech = trim(samples, sampleRate);
    if (speech.length < sampleRate * 0.05) return new Float32Array(0);
    return finish(glitch(vocode(speech, sampleRate, rand), sampleRate, rand), sampleRate);
  }

  const api = { parseWav, robotize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Voice = api;
})(typeof window !== 'undefined' ? window : globalThis);
