// Audio engine: background music (built-in tracks or your own file) + sound effects.
// The same graph feeds the speakers (preview) and a MediaStream (recording),
// so what you hear is what gets recorded.

import { sceneAt, totalDuration, codeTiming, terminalTiming } from './renderer.js';

export const MUSIC_TRACKS = [
  ['none', 'None'],
  ['lofi', 'Lo-fi'],
  ['upbeat', 'Upbeat'],
  ['ambient', 'Ambient'],
  ['file', 'My file'],
];

const SR = 44100;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

/* ---------- synth helpers (work on any BaseAudioContext) ---------- */
function noiseBuffer(ctx, seconds = 1) {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function tone(ctx, dest, { t, dur, freq, type = 'triangle', gain = 0.1, attack = 0.01, release = 0.25, cutoff = 0, detune = 0 }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.setValueAtTime(gain, t + Math.max(attack, dur - release));
  g.gain.linearRampToValueAtTime(0, t + dur);
  let node = o;
  if (cutoff) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    o.connect(f);
    node = f;
  }
  node.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function kick(ctx, dest, t, gain = 0.9) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.4);
}

function noiseHit(ctx, dest, noise, t, { dur = 0.1, hp = 0, lp = 0, bp = 0, q = 1, gain = 0.3 }) {
  const s = ctx.createBufferSource();
  s.buffer = noise;
  let node = s;
  const add = (type, freq) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    node.connect(f);
    node = f;
  };
  if (hp) add('highpass', hp);
  if (lp) add('lowpass', lp);
  if (bp) add('bandpass', bp);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  node.connect(g).connect(dest);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

/* ---------- built-in tracks (rendered once, then looped) ---------- */
const SONGS = {
  lofi: {
    bpm: 78,
    // Am7, Fmaj7, Cmaj7, G6 (one bar each)
    chords: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 64]],
    bass: [45, 41, 48, 43],
    write(ctx, out, noise, beat, bar) {
      const total = 8;
      for (let b = 0; b < total; b++) {
        const t0 = b * bar;
        const ch = this.chords[b % 4];
        ch.forEach((n, i) => tone(ctx, out, { t: t0 + i * 0.02, dur: bar * 0.98, freq: midi(n), type: 'triangle', gain: 0.045, attack: 0.08, release: 0.6, cutoff: 1400, detune: (i % 2 ? 6 : -6) }));
        tone(ctx, out, { t: t0, dur: beat * 1.8, freq: midi(this.bass[b % 4]), type: 'sine', gain: 0.22, release: 0.3 });
        tone(ctx, out, { t: t0 + beat * 2.5, dur: beat * 1.3, freq: midi(this.bass[b % 4]), type: 'sine', gain: 0.16, release: 0.3 });
        // melody: a few soft notes from the chord, one octave up
        [0, 1.5, 3].forEach((k, i) => tone(ctx, out, { t: t0 + k * beat, dur: beat * 0.9, freq: midi(ch[(b + i) % 4] + 12), type: 'sine', gain: 0.04, release: 0.4 }));
        for (let s = 0; s < 4; s++) {
          const t = t0 + s * beat;
          if (s === 0 || s === 2) kick(ctx, out, t + (s === 2 ? beat * 0.5 : 0), 0.6);
          if (s === 1 || s === 3) noiseHit(ctx, out, noise, t, { dur: 0.18, bp: 1800, q: 0.7, gain: 0.18 });
          noiseHit(ctx, out, noise, t, { dur: 0.04, hp: 7000, gain: 0.05 });
          noiseHit(ctx, out, noise, t + beat * 0.55, { dur: 0.03, hp: 7000, gain: 0.035 });
        }
      }
      // vinyl crackle
      for (let i = 0; i < total * 12; i++) noiseHit(ctx, out, noise, Math.random() * total * bar, { dur: 0.01, hp: 3000, gain: 0.03 });
      return total * bar;
    },
  },
  upbeat: {
    bpm: 120,
    // C, G, Am, F
    chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]],
    bass: [36, 43, 45, 41],
    write(ctx, out, noise, beat, bar) {
      const total = 8;
      for (let b = 0; b < total; b++) {
        const t0 = b * bar;
        const ch = this.chords[b % 4];
        for (let s = 0; s < 4; s++) {
          const t = t0 + s * beat;
          kick(ctx, out, t, 0.75);
          noiseHit(ctx, out, noise, t + beat / 2, { dur: 0.05, hp: 8000, gain: 0.09 });
          if (s % 2 === 1) noiseHit(ctx, out, noise, t, { dur: 0.15, bp: 1500, q: 0.8, gain: 0.25 });
          // pluck chord on off-beats
          ch.forEach((n) => tone(ctx, out, { t: t + beat / 2, dur: beat * 0.4, freq: midi(n + 12), type: 'square', gain: 0.018, release: 0.15, cutoff: 2600 }));
        }
        for (let e = 0; e < 8; e++) tone(ctx, out, { t: t0 + e * beat / 2, dur: beat * 0.45, freq: midi(this.bass[b % 4] + (e % 4 === 3 ? 12 : 0)), type: 'sawtooth', gain: 0.07, release: 0.08, cutoff: 600 });
        if (b % 2 === 1) [0, 2, 1, 2].forEach((k, i) => tone(ctx, out, { t: t0 + (i + 0.5) * beat, dur: beat * 0.5, freq: midi(ch[k] + 24), type: 'triangle', gain: 0.035, release: 0.2 }));
      }
      return total * bar;
    },
  },
  ambient: {
    bpm: 64,
    chords: [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 60]],
    write(ctx, out, noise, beat, bar) {
      const total = 8;
      for (let b = 0; b < total; b++) {
        const t0 = b * bar;
        const ch = this.chords[b % 4];
        ch.forEach((n, i) => tone(ctx, out, { t: t0, dur: bar + 0.8, freq: midi(n), type: 'sine', gain: 0.06, attack: 1.2, release: 1.4, detune: i * 4 - 6 }));
        ch.forEach((n, i) => tone(ctx, out, { t: t0, dur: bar + 0.8, freq: midi(n + 12), type: 'triangle', gain: 0.015, attack: 1.5, release: 1.4, cutoff: 1200 }));
        for (let k = 0; k < 8; k++) tone(ctx, out, { t: t0 + k * beat / 2, dur: beat * 1.2, freq: midi(ch[(k * 3) % 4] + 24), type: 'sine', gain: 0.025, release: 0.8 });
      }
      return total * bar;
    },
  },
};

async function renderSong(id) {
  const song = SONGS[id];
  const beat = 60 / song.bpm;
  const bar = beat * 4;
  const len = 8 * bar;
  const ctx = new OfflineAudioContext(2, Math.ceil((len + 0.01) * SR), SR);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 4;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(comp).connect(ctx.destination);
  song.write(ctx, master, noiseBuffer(ctx, 2), beat, bar);
  return ctx.startRendering();
}

/* ---------- engine ---------- */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.cache = new Map(); // built-in track id -> AudioBuffer
    this.custom = new Map(); // 'music' | 'typing' | 'whoosh' | 'scene:<id>' -> AudioBuffer
    this.nodes = [];
  }

  /** Must be called from a click (browsers only allow audio after a gesture). */
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC({ sampleRate: SR });
      this.master = this.ctx.createGain();
      this.recordDest = this.ctx.createMediaStreamDestination();
      this.master.connect(this.ctx.destination);
      this.master.connect(this.recordDest);
      this.noise = noiseBuffer(this.ctx, 2);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  get stream() { return this.recordDest ? this.recordDest.stream : null; }

  /** Decode an audio file. Works before any click (uses an offline context). */
  async decode(fileOrBlob) {
    const data = await fileOrBlob.arrayBuffer();
    const off = new OfflineAudioContext(2, 1, SR);
    return off.decodeAudioData(data);
  }

  /** Play a buffer right away (voice preview). */
  playOnce(buf) {
    const ctx = this.ensure();
    if (!ctx || !buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
  }

  setCustom(key, buffer) { if (buffer) this.custom.set(key, buffer); else this.custom.delete(key); }
  getCustom(key) { return this.custom.get(key) || null; }
  get userBuffer() { return this.custom.get('music') || null; }

  async musicBuffer(id) {
    if (id === 'none') return null;
    if (id === 'file') return this.custom.get('music') || null;
    if (!this.cache.has(id)) this.cache.set(id, renderSong(id));
    return this.cache.get(id);
  }

  stop() {
    const now = this.ctx ? this.ctx.currentTime : 0;
    this.nodes.forEach((n) => {
      try {
        if (n.gain) { n.gain.cancelScheduledValues(now); n.gain.setValueAtTime(n.gain.value, now); n.gain.linearRampToValueAtTime(0, now + 0.05); }
        else n.stop(now + 0.06);
      } catch { /* already stopped */ }
    });
    this.nodes = [];
    this.token = (this.token || 0) + 1;
  }

  /** Start sound from project time t0. Returns a promise that resolves once music is scheduled. */
  async start(p, t0) {
    const ctx = this.ensure();
    if (!ctx) return;
    this.stop();
    const token = this.token;
    const total = totalDuration(p);
    const startAt = ctx.currentTime + 0.03;
    const toCtx = (t) => startAt + (t - t0);

    this.scheduleSfx(p, t0, total, toCtx);
    const ducks = this.scheduleSceneAudio(p, t0, toCtx);

    const buf = await this.musicBuffer(p.music);
    if (!buf || token !== this.token) return;
    // the await may have taken time: work out where we are now
    const lag = Math.max(0, ctx.currentTime + 0.02 - startAt);
    const from = t0 + lag;
    if (from >= total) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    const duck = ctx.createGain();
    const vol = (p.musicVol ?? 60) / 100 * 0.8;
    const when = toCtx(from);
    const end = toCtx(total);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + (from < 0.1 ? 0.15 : 0.35));
    const fadeStart = Math.max(when + 0.4, end - 1.5);
    g.gain.setValueAtTime(vol, fadeStart);
    g.gain.linearRampToValueAtTime(0, end);
    // lower the music while a scene's own audio plays
    duck.gain.setValueAtTime(1, when);
    if (p.duck) {
      ducks.forEach(([s0, e0]) => {
        if (e0 <= from) return;
        const ds = Math.max(s0, from);
        if (ds > from + 0.01) {
          duck.gain.setValueAtTime(1, toCtx(Math.max(from, ds - 0.25)));
          duck.gain.linearRampToValueAtTime(0.22, toCtx(ds));
        } else duck.gain.setValueAtTime(0.22, when);
        duck.gain.setValueAtTime(0.22, toCtx(e0));
        duck.gain.linearRampToValueAtTime(1, toCtx(e0 + 0.35));
      });
    }
    src.connect(g).connect(duck).connect(this.master);
    src.start(when, from % buf.duration);
    src.stop(end + 0.05);
    this.nodes.push(src, g, duck);
  }

  /** Each scene's own audio (voiceover, sound effect). Returns merged [start, end] times for ducking. */
  scheduleSceneAudio(p, t0, toCtx) {
    const ctx = this.ctx;
    const vol = (p.sceneVol ?? 100) / 100;
    const spans = [];
    let acc = 0;
    p.scenes.forEach((sc) => {
      let start = acc;
      const end = acc + sc.dur;
      acc = end;
      // your uploaded audio wins; otherwise the automatic voiceover, if it's on
      let buf = this.custom.get('scene:' + sc.id);
      let lead = 0;
      if (!buf && sc.voice) { buf = this.custom.get('tts:' + sc.id); lead = 0.15; }
      if (!buf) return;
      const start0 = start;
      start = start0 + lead;
      if (start >= end) return;
      const stopAt = Math.min(end, start + buf.duration);
      spans.push([start, stopAt]);
      if (stopAt <= t0) return;
      const from = Math.max(t0, start);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, toCtx(from));
      g.gain.setValueAtTime(vol, toCtx(Math.max(from, stopAt - 0.08)));
      g.gain.linearRampToValueAtTime(0, toCtx(stopAt));
      src.connect(g).connect(this.master);
      src.start(toCtx(from), from - start);
      src.stop(toCtx(stopAt) + 0.02);
      this.nodes.push(src, g);
    });
    // merge spans that nearly touch so the music doesn't pump between scenes
    const merged = [];
    spans.forEach(([s0, e0]) => {
      const last = merged[merged.length - 1];
      if (last && s0 - last[1] < 0.7) last[1] = Math.max(last[1], e0);
      else merged.push([s0, e0]);
    });
    return merged;
  }

  scheduleSfx(p, t0, total, toCtx) {
    const ctx = this.ctx;
    const out = this.master;
    const sfxGain = ctx.createGain();
    sfxGain.gain.value = (p.sfxVol ?? 70) / 100;
    sfxGain.connect(out);
    this.nodes.push(sfxGain);
    const track = (n) => this.nodes.push(n);

    const typingBuf = this.custom.get('typing');
    const whooshBuf = this.custom.get('whoosh');
    const playBuf = (buf, when, offset = 0, until = null, rate = 1) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      src.connect(sfxGain);
      src.start(when, offset);
      if (until) src.stop(until);
      track(src);
    };
    // typing over [from, to] (project time) with `chars` characters of text
    const typeSpan = (text, from, to, sceneEnd) => {
      const chars = text.length;
      if (!chars || to <= from) return;
      if (typingBuf && typingBuf.duration > 0.4) {
        // a recorded typing loop: play it for the whole span
        const a = Math.max(from, t0);
        if (a >= to) return;
        const src = ctx.createBufferSource();
        src.buffer = typingBuf;
        src.loop = true;
        const g = ctx.createGain();
        g.gain.setValueAtTime(1, toCtx(a));
        g.gain.setValueAtTime(1, toCtx(Math.max(a, to - 0.08)));
        g.gain.linearRampToValueAtTime(0, toCtx(to));
        src.connect(g).connect(sfxGain);
        src.start(toCtx(a), (a - from) % typingBuf.duration);
        src.stop(toCtx(to) + 0.02);
        track(src); track(g);
        return;
      }
      const per = (to - from) / chars;
      const step = Math.max(per, 1 / 16); // at most 16 clicks a second
      for (let k = 0; k * step < to - from; k++) {
        const ch = text[Math.floor((k * step) / per)];
        if (ch === ' ' || ch === '\n') continue;
        const t = from + k * step + (Math.random() - 0.5) * step * 0.3;
        if (t < t0 || t > sceneEnd) continue;
        if (typingBuf) playBuf(typingBuf, toCtx(t), 0, null, 0.94 + Math.random() * 0.12);
        else this.click(sfxGain, toCtx(t), track);
      }
    };

    let acc = 0;
    p.scenes.forEach((sc, i) => {
      const start = acc;
      acc += sc.dur;
      // transition sound into every scene after the first
      if (p.sfxWhoosh && i > 0) {
        if (whooshBuf) {
          const lead = Math.min(0.15, whooshBuf.duration / 2);
          const at = start - lead;
          if (at >= t0) playBuf(whooshBuf, toCtx(at));
          else if (at + whooshBuf.duration > t0) playBuf(whooshBuf, toCtx(t0), t0 - at);
        } else if (start - 0.18 >= t0) this.whoosh(sfxGain, toCtx(start - 0.18), track);
      }
      if (!p.sfxTyping || !sc.typing) return;
      if (sc.type === 'code') {
        const code = (sc.code || '').replace(/\t/g, '  ');
        const { typeStart, typeDur } = codeTiming(sc);
        typeSpan(code, start + typeStart, start + typeStart + typeDur, start + sc.dur);
      } else if (sc.type === 'terminal') {
        const { cmdStart, cmdDur } = terminalTiming(sc);
        typeSpan(sc.command || '', start + cmdStart, start + cmdStart + cmdDur, start + sc.dur);
      }
    });
  }

  click(dest, when, track) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2200 + Math.random() * 1800;
    f.Q.value = 3;
    const g = ctx.createGain();
    const v = 0.35 + Math.random() * 0.25;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(v, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.04);
    s.connect(f).connect(g).connect(dest);
    s.start(when, Math.random() * 1.5);
    s.stop(when + 0.05);
    // low "thock" body
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.frequency.value = 160 + Math.random() * 60;
    og.gain.setValueAtTime(0.12, when);
    og.gain.exponentialRampToValueAtTime(0.001, when + 0.03);
    o.connect(og).connect(dest);
    o.start(when);
    o.stop(when + 0.04);
    track(s); track(o);
  }

  whoosh(dest, when, track) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(400, when);
    f.frequency.exponentialRampToValueAtTime(3500, when + 0.22);
    f.frequency.exponentialRampToValueAtTime(900, when + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.35, when + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.42);
    s.connect(f).connect(g).connect(dest);
    s.start(when, Math.random());
    s.stop(when + 0.45);
    track(s);
  }
}

export { sceneAt };
