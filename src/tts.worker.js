// Runs the Kokoro text-to-speech model in a background thread so the editor never freezes.
// The model (about 90 MB) downloads once from Hugging Face, then the browser caches it.

import { KokoroTTS } from 'kokoro-js';

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
let ttsPromise = null;
const files = new Map(); // file -> { loaded, total }

function load() {
  if (!ttsPromise) {
    ttsPromise = KokoroTTS.from_pretrained(MODEL_ID, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (info) => {
        if (info && info.file && typeof info.total === 'number') {
          files.set(info.file, { loaded: info.loaded || 0, total: info.total || 0 });
          let loaded = 0, total = 0;
          files.forEach((f) => { loaded += f.loaded; total += f.total; });
          self.postMessage({ type: 'progress', loaded, total });
        }
      },
    }).then((tts) => { self.postMessage({ type: 'loaded' }); return tts; });
    ttsPromise.catch(() => { ttsPromise = null; });
  }
  return ttsPromise;
}

// one job at a time, in the order they arrive
let queue = Promise.resolve();

self.onmessage = (e) => {
  const { id, text, voice, speed } = e.data;
  queue = queue.then(async () => {
    try {
      const tts = await load();
      const out = await tts.generate(text, { voice, speed });
      const pcm = out.audio || out.data;
      const sr = out.sampling_rate || 24000;
      const copy = new Float32Array(pcm);
      self.postMessage({ type: 'done', id, pcm: copy, sr }, [copy.buffer]);
    } catch (err) {
      self.postMessage({ type: 'error', id, message: String((err && err.message) || err) });
    }
  });
};
