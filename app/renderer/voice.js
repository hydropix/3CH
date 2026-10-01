// Robot voice: turns a plain text-to-speech recording into a broken machine
// that sings. Each playback draws a key, a tempo and a tune; a channel vocoder
// sings the words on it, then glitches cut on the beat and tuned to the key.
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

  // RBJ high-pass, Q 0.707.
  function highpass(x, freq, sampleRate) {
    const w = (2 * Math.PI * freq) / sampleRate;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / Math.SQRT2;
    const a0 = 1 + alpha;
    const b0 = (1 + cos) / 2 / a0;
    const b1 = -(1 + cos) / a0;
    const a1 = (-2 * cos) / a0;
    const a2 = (1 - alpha) / a0;
    const out = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const y = b0 * (x[i] + x2) + b1 * x1 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x[i];
      y2 = y1;
      y1 = y;
      out[i] = y;
    }
    return out;
  }

  const pick = (list, rand) => list[Math.floor(rand() * list.length)];

  // ---------- Music ----------

  // Every sentence is sung in a key drawn from these scales (semitones): odd
  // modes, but every note of the melody, the harmony and the glitches belongs.
  const SCALES = [
    [0, 3, 5, 7, 10], // minor pentatonic
    [0, 2, 4, 7, 9], // major pentatonic
    [0, 2, 3, 7, 8], // hirajoshi
    [0, 2, 3, 5, 7, 9, 10], // dorian
    [0, 1, 3, 5, 7, 8, 10], // phrygian
    [0, 2, 3, 5, 7, 8, 11], // harmonic minor
    [0, 2, 4, 6, 7, 9, 11], // lydian
    [0, 2, 4, 6, 8, 10], // whole tone
  ];
  // Harmony voices, in scale degrees above the melody (so they stay in key).
  const VOICINGS = [[0], [0], [0, 2], [0, 4], [0, 2, 4], [0, 4, 7]];
  // Chords of a progression (degrees), one per bar of 16 steps.
  const CHORDS = [0, 0, 3, 4, 5, -2, -3];
  // Chord tones, for the arpeggios.
  const ARP = [0, 2, 4, 7];
  // Speeds of the reading, around the normal one.
  const SPEEDS = [0.8, 0.9, 1, 1, 1, 1.12, 1.25];
  // Harmonic series: a stutter climbing it stays consonant with itself.
  const HARMONICS = [1, 1.5, 2, 3];

  // Draws how a sentence is sung: key, tempo, melody shape, harmony, effects.
  // `options` overrides any field (the countdown shares one style).
  function compose(rand, options = {}) {
    const bpm = options.bpm ?? 92 + Math.floor(rand() * 50);
    const style = {
      scale: pick(SCALES, rand),
      root: 440 * 2 ** ((38 + Math.floor(rand() * 10) - 69) / 12), // D2 to B2
      bpm,
      contour: pick(['walk', 'arp', 'motif', 'drone'], rand),
      voicing: pick(VOICINGS, rand),
      progression: Array.from({ length: 2 + Math.floor(rand() * 3) }, (_, k) => (k ? pick(CHORDS, rand) : 0)),
      transpose: 0,
      glide: 0.1 + rand() * 0.4, // share of the notes that slide in
      glideTime: 0.03 + rand() * 0.06,
      vibrato: rand() < 0.6 ? 0.1 + rand() * 0.25 : 0, // semitones
      vibratoRate: 4.5 + rand() * 2,
      detune: 3 + rand() * 6, // cents between the voices
      rubato: rand() < 0.75 ? 0.5 + rand() * 0.5 : 0,
      ritardando: rand() < 0.3,
      chaos: 0.15 + rand() * 0.15, // share of the segments that break
      comb: rand() < 0.3 ? { octave: pick([2, 4], rand), feedback: 0.55 + rand() * 0.25, mix: 0.25 + rand() * 0.2 } : null,
      echo: rand() < 0.55 ? { steps: pick([2, 3, 4], rand), feedback: 0.25 + rand() * 0.2, wet: 0.2 + rand() * 0.15 } : null,
    };
    Object.assign(style, options);
    style.step = 15 / style.bpm; // a sixteenth note, in seconds
    return style;
  }

  function noteHz(style, degree) {
    const n = style.scale.length;
    const octave = Math.floor(degree / n);
    return style.root * 2 ** ((style.scale[degree - octave * n] + 12 * octave) / 12);
  }

  // The tune, in scale degrees, on a grid of sixteenth notes.
  function melody(steps, style, rand) {
    const motif = Array.from({ length: 3 + Math.floor(rand() * 3) }, () => ({
      degree: Math.floor(rand() * 6) - 1,
      steps: pick([1, 2, 2, 3, 4], rand),
    }));
    const down = rand() < 0.4;
    const notes = [];
    let degree = 0;
    for (let at = 0, k = 0; at < steps; k++) {
      const chord = style.progression[Math.floor(at / 16) % style.progression.length];
      let length;
      if (style.contour === 'walk') {
        degree = Math.max(-2, Math.min(7, degree + pick([-2, -1, -1, 0, 1, 1, 2], rand)));
        length = pick([1, 2, 2, 3], rand);
      } else if (style.contour === 'arp') {
        degree = chord + ARP[down ? ARP.length - 1 - (k % ARP.length) : k % ARP.length];
        length = pick([1, 2, 2], rand);
      } else if (style.contour === 'motif') {
        const m = motif[k % motif.length];
        degree = chord + m.degree;
        length = m.steps;
      } else {
        degree = chord + (k && rand() < 0.3 ? pick([1, 2, 4, -1], rand) : 0);
        length = 2 + Math.floor(rand() * 5);
      }
      notes.push({ at, steps: length, degree: degree + style.transpose, glide: k > 0 && rand() < style.glide });
      at += length;
    }
    return notes;
  }

  // Detuned sawtooth voices singing the tune: sliding into some notes, with a
  // vibrato that sets in as each note is held.
  function carrier(length, sampleRate, style, rand) {
    const saw = new Float32Array(length);
    const step = style.step * sampleRate;
    const notes = melody(Math.ceil(length / step), style, rand);
    const voices = style.voicing.map((offset, v) => ({
      offset,
      gain: v ? 0.55 : 1,
      cents: v ? (v % 2 ? 1 : -1) * style.detune : 0,
      phase: rand(),
      pitch: null, // log2 of the frequency
    }));
    const total = voices.reduce((sum, v) => sum + v.gain, 0);
    const snap = 1 - Math.exp(-1 / (0.003 * sampleRate));
    const slide = 1 - Math.exp(-1 / (style.glideTime * sampleRate));
    const vib = (2 * Math.PI * style.vibratoRate) / sampleRate;
    for (const note of notes) {
      const start = Math.round(note.at * step);
      const end = Math.min(length, Math.round((note.at + note.steps) * step));
      const coef = note.glide ? slide : snap;
      const targets = voices.map((v) => Math.log2(noteHz(style, note.degree + v.offset)) + v.cents / 1200);
      voices.forEach((v, j) => (v.pitch ??= targets[j]));
      for (let i = start; i < end; i++) {
        const held = Math.min(1, (i - start) / (0.25 * sampleRate));
        const wobble = (style.vibrato * held * Math.sin(vib * i)) / 12;
        let s = 0;
        for (let j = 0; j < voices.length; j++) {
          const v = voices[j];
          v.pitch += (targets[j] - v.pitch) * coef;
          v.phase += 2 ** (v.pitch + wobble) / sampleRate;
          v.phase -= Math.floor(v.phase);
          s += v.gain * (2 * v.phase - 1);
        }
        saw[i] = s / total;
      }
    }
    return saw;
  }

  // Reads the speech at a changing speed, before the vocoder: the words rush
  // and drag, the formants follow, the pitch (the carrier's) stays in key.
  function warp(x, sampleRate, style, rand) {
    if (!style.rubato && !style.ritardando) return x;
    const beat = 4 * style.step * sampleRate;
    const knots = [];
    for (let at = 0; at <= x.length + 3 * beat; at += beat * (1 + Math.floor(rand() * 2))) {
      knots.push({ at, speed: 1 + (pick(SPEEDS, rand) - 1) * style.rubato });
    }
    const rit = style.ritardando ? Math.min(x.length, Math.round(sampleRate * 0.5)) : 0;
    const out = new Float32Array(Math.ceil(x.length / 0.4) + 2);
    let n = 0;
    for (let at = 0, k = 0; at < x.length - 1; n++) {
      while (knots[k + 1].at <= at) k++;
      const a = knots[k];
      const b = knots[k + 1];
      const u = (at - a.at) / (b.at - a.at);
      let speed = a.speed + ((b.speed - a.speed) * (1 - Math.cos(Math.PI * u))) / 2;
      if (at > x.length - rit) speed *= 1 - (0.4 * (at - (x.length - rit))) / rit;
      const i = Math.floor(at);
      const t = at - i;
      out[n] = x[i] * (1 - t) + x[i + 1] * t;
      at += speed;
    }
    return out.slice(0, n);
  }

  // Channel vocoder: the speech's spectral envelope, sung by the carrier
  // (plus noise in the top bands so that s, t and f survive). The original's
  // highs are mixed back in for intelligibility: consonants, not its pitch,
  // which would be out of key.
  function vocode(x, sampleRate, style, rand) {
    const saw = carrier(x.length, sampleRate, style, rand);
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

    const air = normalize(highpass(x, 1500, sampleRate));
    for (let i = 0; i < out.length; i++) out[i] += 0.2 * air[i];
    return out;
  }

  // A metal tube tuned to the key: a feedback comb on the root, octaves up.
  function resonate(x, sampleRate, style) {
    const { octave, feedback, mix } = style.comb;
    const period = Math.max(1, Math.round(sampleRate / (style.root * octave)));
    const ring = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) ring[i] = x[i] + (i >= period ? feedback * ring[i - period] : 0);
    normalize(ring, peak(x));
    for (let i = 0; i < x.length; i++) x[i] = (1 - mix) * x[i] + mix * ring[i];
    return x;
  }

  // ---------- Glitches, on the beat ----------

  // "d-d-d-devours": the head of the segment rolled in 32nd or 64th notes over
  // one step, sometimes climbing the harmonic series.
  function roll(seg, step, rand) {
    const parts = pick([2, 4], rand);
    const sub = Math.floor(step / parts);
    const head = fade(seg.slice(0, sub), 20);
    const climb = rand() < 0.5;
    const out = new Float32Array(sub * parts);
    for (let p = 0; p < parts; p++) {
      const grain = climb && p ? resample(head, HARMONICS[p]) : head;
      const gain = 0.6 + (0.4 * p) / parts;
      for (let i = 0; i < sub && i < grain.length; i++) out[p * sub + i] = gain * grain[i];
    }
    return concat([out, seg]);
  }

  // A grain looped at the period of a note of the key: a frozen, pitched buzz.
  function freeze(seg, step, sampleRate, style, rand) {
    const hz = noteHz(style, style.transpose + pick(ARP, rand)) * 4;
    const cycles = Math.max(1, Math.ceil(0.008 * hz));
    const length = Math.max(1, Math.round((cycles * sampleRate) / hz));
    const from = Math.max(0, Math.floor(seg.length / 2 - length / 2));
    const grain = seg.slice(from, from + length);
    const out = new Float32Array(step * pick([1, 2], rand));
    const decay = Math.log(0.15) / out.length;
    for (let i = 0; i < out.length; i++) out[i] = (grain[i % length] || 0) * Math.exp(decay * i);
    return concat([fade(out, 30), seg]);
  }

  // A trance gate: the segment chopped in 32nd or 64th notes.
  function gate(seg, step, sampleRate, rand) {
    const sub = Math.max(1, Math.floor(step / pick([2, 4], rand)));
    const ramp = Math.round(sampleRate * 0.002);
    const out = Float32Array.from(seg);
    for (let at = 0, k = 0; at < out.length; at += sub, k++) {
      if (!k || rand() < 0.6) continue;
      const end = Math.min(out.length, at + sub);
      for (let i = at; i < end; i++) out[i] *= 1 - Math.min(1, (i - at) / ramp, (end - i) / ramp);
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

  // An octave (or a fifth) up or down, looped to keep the segment's length,
  // so the beat holds.
  function shift(seg, rand) {
    const sped = fade(resample(seg, pick([2, 2, 0.5, 1.5], rand)), 30);
    const out = new Float32Array(seg.length);
    for (let i = 0; i < out.length; i++) out[i] = sped[i % sped.length];
    return out;
  }

  // Fewer bits and a lower sample rate.
  function crush(seg, rand) {
    const levels = 2 ** (4 + Math.floor(rand() * 2));
    const hold = 2 + Math.floor(rand() * 3);
    const out = new Float32Array(seg.length);
    let v = 0;
    for (let i = 0; i < seg.length; i++) {
      if (i % hold === 0) v = Math.round(seg[i] * levels) / levels;
      out[i] = v;
    }
    return out;
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

  // Cuts the sound on the grid (1 to 4 sixteenths) and breaks some segments.
  // Every glitch keeps whole steps, so the sentence stays in time.
  function glitch(x, sampleRate, style, rand) {
    const step = Math.max(1, Math.round(style.step * sampleRate));
    const chunks = [];
    for (let i = 0; i < x.length; ) {
      const len = Math.min(x.length - i, step * pick([1, 2, 2, 3, 4], rand));
      let seg = x.slice(i, i + len);
      i += len;
      if (rand() < style.chaos) {
        const r = rand();
        if (r < 0.25) seg = roll(seg, step, rand);
        else if (r < 0.4) seg = freeze(seg, step, sampleRate, style, rand);
        else if (r < 0.55) seg = gate(seg, step, sampleRate, rand);
        else if (r < 0.7) seg = shift(seg, rand);
        else if (r < 0.8) seg = fade(seg.reverse(), 30);
        else if (r < 0.9) seg = concat([new Float32Array(step), seg]); // a rest
        else seg = crush(seg, rand);
      }
      chunks.push(seg);
    }
    const out = concat(chunks);
    return rand() < 0.1 ? tapeStop(out, sampleRate) : out;
  }

  // An echo on the beat, darker at every repeat.
  function echo(x, sampleRate, style) {
    const { steps, feedback, wet } = style.echo;
    const delay = Math.max(1, Math.round(steps * style.step * sampleRate));
    const out = new Float32Array(x.length + 2 * delay);
    const line = new Float32Array(out.length);
    let dark = 0;
    for (let i = 0; i < out.length; i++) {
      const dry = i < x.length ? x[i] : 0;
      dark += 0.35 * ((i >= delay ? line[i - delay] : 0) - dark);
      line[i] = dry + feedback * dark;
      out[i] = dry + wet * dark;
    }
    const tail = out.subarray(x.length);
    for (let i = 0; i < tail.length; i++) tail[i] *= 1 - i / tail.length;
    return out;
  }

  // Light soft clipping, then a safe level.
  function finish(x, sampleRate) {
    for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * 1.2);
    return fade(normalize(x, 0.9), Math.round(sampleRate * 0.005));
  }

  // `style` (see compose) is drawn anew for every playback unless given.
  function robotize(samples, sampleRate, rand = Math.random, style = compose(rand)) {
    const speech = trim(samples, sampleRate);
    if (speech.length < sampleRate * 0.05) return new Float32Array(0);
    let x = vocode(warp(speech, sampleRate, style, rand), sampleRate, style, rand);
    if (style.comb) x = resonate(x, sampleRate, style);
    x = glitch(x, sampleRate, style, rand);
    if (style.echo) x = echo(x, sampleRate, style);
    return finish(x, sampleRate);
  }

  const api = { parseWav, compose, robotize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Voice = api;
})(typeof window !== 'undefined' ? window : globalThis);
