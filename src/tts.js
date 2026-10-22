// Text-to-speech for automatic voiceovers. Talks to tts.worker.js.

export const VOICES = [
  ['af_heart', 'Heart · US female'],
  ['af_bella', 'Bella · US female'],
  ['af_nicole', 'Nicole · US female, soft'],
  ['am_michael', 'Michael · US male'],
  ['am_fenrir', 'Fenrir · US male'],
  ['am_puck', 'Puck · US male'],
  ['bf_emma', 'Emma · UK female'],
  ['bm_george', 'George · UK male'],
  ['bm_fable', 'Fable · UK male'],
];

let worker = null;
let nextId = 1;
const jobs = new Map();
const progressListeners = new Set();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./tts.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'progress' || m.type === 'loaded') { progressListeners.forEach((fn) => fn(m)); return; }
    const job = jobs.get(m.id);
    if (!job) return;
    jobs.delete(m.id);
    if (m.type === 'done') job.resolve({ pcm: m.pcm, sr: m.sr });
    else job.reject(new Error(m.message));
  };
  worker.onerror = (e) => {
    jobs.forEach((j) => j.reject(new Error(e.message || 'Voice engine failed to start')));
    jobs.clear();
    worker = null;
  };
  return worker;
}

/** Listen to model download progress: fn({ type: 'progress', loaded, total } | { type: 'loaded' }). */
export function onModelProgress(fn) {
  progressListeners.add(fn);
  return () => progressListeners.delete(fn);
}

/** Text as it should be spoken: no *highlight* stars, no stray symbols. */
export function speakableText(text) {
  return (text || '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Generate speech. Resolves to { pcm: Float32Array, sr: number }. */
export function synthesize(text, voice = 'af_heart', speed = 1) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    jobs.set(id, { resolve, reject });
    getWorker().postMessage({ id, text, voice, speed });
  });
}

/** Stable key for a piece of speech, used to cache it. */
export function voiceKey(text, voice, speed) {
  const s = `${voice}|${speed}|${text}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + s.length.toString(36);
}

/** Float32 PCM -> AudioBuffer (works before any click). */
export function toAudioBuffer(pcm, sr) {
  const buf = new AudioBuffer({ length: Math.max(1, pcm.length), numberOfChannels: 1, sampleRate: sr });
  buf.copyToChannel(pcm, 0);
  return buf;
}

/** AudioBuffer -> 16-bit WAV Blob, so a voiceover can be saved and reloaded. */
export function toWav(buf) {
  const data = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + data.length * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); out.setUint32(4, 36 + data.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, sr, true); out.setUint32(28, sr * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
  str(36, 'data'); out.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) {
    const v = Math.max(-1, Math.min(1, data[i]));
    out.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Blob([out], { type: 'audio/wav' });
}
