import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SAMPLE_PROJECT, DEFAULTS, FONTS, newScene, uid } from './presets.js';
import {
  renderFrame, totalDuration, sceneAt, fmtTime, clearLayoutCache, clamp, W, H,
  sceneLayout, naturalSize, fittedHeight,
} from './renderer.js';
import SceneCard, { TypeIcon } from './components/SceneCard.jsx';
import LookPanel from './components/LookPanel.jsx';
import ResultModal from './components/ResultModal.jsx';
import StageEditor from './components/StageEditor.jsx';
import TemplatesModal from './components/TemplatesModal.jsx';
import { ScreenDialog, Countdown, RecBar } from './components/ScreenRecorder.jsx';
import CropSelector from './components/CropSelector.jsx';
import { AudioEngine } from './audio.js';
import { saveFile, deleteFile, loadAllFiles } from './store.js';
import { synthesize, speakableText, voiceKey, toAudioBuffer, toWav, onModelProgress } from './tts.js';
import { loadImage, loadVideo, videoDuration, hasSound, canRecordScreen, openScreenSession } from './media.js';

const STORAGE_KEY = 'shortsmith-project-v2';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const half = (v) => Math.round(v * 2) / 2;

function loadProject() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && Array.isArray(saved.scenes) && saved.scenes.length) {
      saved.scenes = saved.scenes.map((s) => ({ ...newScene(s.type || 'text'), ...s, id: s.id || uid() }));
      return { ...DEFAULTS, ...saved };
    }
  } catch { /* ignore */ }
  return SAMPLE_PROJECT;
}

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  const list = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm',
  ];
  return list.find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } }) || null;
}

/** Where to park the playhead so a scene is shown at rest (after its entrance). */
function restTime(sc) {
  if (sc.type === 'code' || sc.type === 'terminal') return sc.dur * 0.8;
  if (sc.type === 'image' || sc.type === 'video') return Math.min(1, sc.dur * 0.5);
  return Math.min(1.4, sc.dur * 0.8);
}

const ADD_TILES = [
  ['text', 'Text', 'Headline or caption'],
  ['image', 'Image', 'Screenshot, photo'],
  ['video', 'Video', 'Clip or recording'],
  ['screen', 'Record screen', 'Capture a tool live'],
  ['code', 'Code', 'Typing code editor'],
  ['terminal', 'Terminal', 'Command + output'],
];

export default function App() {
  const [project, setProject] = useState(loadProject);
  const projRef = useRef(project);
  projRef.current = project;

  const assets = useRef({ bgImg: null, images: new Map(), videos: new Map(), logo: null, live: null });
  const engine = useRef(null);
  if (!engine.current) engine.current = new AudioEngine();
  const [files, setFiles] = useState({}); // names of uploaded project-wide files
  const [logoUrl, setLogoUrl] = useState('');
  const [mediaTick, setMediaTick] = useState(0);
  const bump = () => setMediaTick((n) => n + 1);
  const setFileName = (key, name) => setFiles((f) => { const n = { ...f }; if (name) n[key] = name; else delete n[key]; return n; });

  const canvasRef = useRef(null);
  const tcRef = useRef(null);
  const headRef = useRef(null);
  const recTextRef = useRef(null);
  const clock = useRef({ t: 1, playing: false, startAt: 0, dirty: true });
  const [playing, setPlayingState] = useState(false);
  const [active, setActive] = useState(0); // scene under the playhead
  const [sel, setSel] = useState(0); // scene open in the list
  const [edSel, setEdSel] = useState(null); // part selected on the preview
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef(null);
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [screen, setScreen] = useState(null); // { phase, target, session, count }
  const screenRef = useRef(null);
  screenRef.current = screen;
  const screenJob = useRef(null);
  const canRecord = canRecordScreen();

  // automatic voiceovers
  const [voiceStatus, setVoiceStatus] = useState({});
  const [model, setModel] = useState(null);
  const [restored, setRestored] = useState(false);
  const voiceKeys = useRef(new Map());
  const voiceCache = useRef(new Map());
  const storedVoices = useRef(new Map());
  const pendingVoices = useRef(0);

  const total = totalDuration(project);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setToast(''), 4200);
  }, []);

  /* ---------- persistence ---------- */
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); } catch { /* ignore */ }
    clock.current.dirty = true;
  }, [project]);
  useEffect(() => { clock.current.dirty = true; }, [mediaTick]);
  const restartAudio = () => { if (clock.current.playing && !exportRef.current) engine.current.start(projRef.current, clock.current.t); };

  /* ---------- undo / redo ---------- */
  const hist = useRef({ past: [], future: [], last: 0, skip: false, prev: project });
  const [, setHistTick] = useState(0);
  useEffect(() => {
    const h = hist.current;
    if (h.skip) { h.skip = false; h.prev = project; setHistTick((n) => n + 1); return; }
    if (h.prev === project) return;
    const now = Date.now();
    if (now - h.last > 700) { h.past.push(h.prev); if (h.past.length > 120) h.past.shift(); }
    h.last = now;
    h.future = [];
    h.prev = project;
    setHistTick((n) => n + 1);
  }, [project]);
  const undo = useCallback(() => {
    const h = hist.current;
    if (!h.past.length) return;
    h.future.push(projRef.current);
    h.skip = true;
    h.last = 0;
    setProject(h.past.pop());
  }, []);
  const redo = useCallback(() => {
    const h = hist.current;
    if (!h.future.length) return;
    h.past.push(projRef.current);
    h.skip = true;
    h.last = 0;
    setProject(h.future.pop());
  }, []);

  /* ---------- automatic voiceovers ---------- */
  useEffect(() => onModelProgress((m) => {
    if (m.type === 'loaded') setModel('loaded');
    else setModel((old) => (old === 'loaded' ? old : { pct: m.total ? Math.round((m.loaded / m.total) * 100) : 0, mb: Math.round(m.total / 1e6) }));
  }), []);
  const setVStatus = (id, st) => setVoiceStatus((v) => ({ ...v, [id]: st }));

  const syncVoices = async () => {
    const p = projRef.current;
    const jobs = p.scenes.map(async (sc) => {
      const text = speakableText(sc.say || sc.text);
      if (!sc.voice || !text) {
        if (voiceKeys.current.has(sc.id)) { engine.current.setCustom('tts:' + sc.id, null); voiceKeys.current.delete(sc.id); }
        return;
      }
      const key = voiceKey(text, p.ttsVoice, p.ttsSpeed);
      if (voiceKeys.current.get(sc.id) === key) return;
      voiceKeys.current.set(sc.id, key);
      setVStatus(sc.id, 'working');
      pendingVoices.current++;
      try {
        let buf = voiceCache.current.get(key);
        if (!buf && storedVoices.current.has(key)) buf = await engine.current.decode(storedVoices.current.get(key));
        if (!buf) {
          const { pcm, sr } = await synthesize(text, p.ttsVoice, p.ttsSpeed);
          buf = toAudioBuffer(pcm, sr);
          const wav = toWav(buf);
          storedVoices.current.set(key, wav);
          saveFile('tts:' + key, wav);
        }
        voiceCache.current.set(key, buf);
        if (voiceKeys.current.get(sc.id) !== key) return;
        engine.current.setCustom('tts:' + sc.id, buf);
        const vd = Math.round(buf.duration * 10) / 10;
        setProject((prev) => ({
          ...prev,
          scenes: prev.scenes.map((s) => {
            if (s.id !== sc.id) return s;
            const need = Math.ceil((vd + 0.5) * 2) / 2;
            return { ...s, voiceKey: key, voiceDur: vd, dur: s.dur < need ? clamp(need, 1, 180) : s.dur };
          }),
        }));
        setVStatus(sc.id, 'ready');
        setTimeout(restartAudio, 0);
      } catch (err) {
        if (voiceKeys.current.get(sc.id) === key) voiceKeys.current.delete(sc.id);
        setVStatus(sc.id, 'error');
        showToast('Voiceover could not be made: ' + (err.message || 'unknown error') + '. Check your internet connection for the first download.');
      } finally {
        pendingVoices.current--;
      }
    });
    await Promise.all(jobs);
  };
  const syncRef = useRef(syncVoices);
  syncRef.current = syncVoices;
  const voiceSig = project.scenes.map((sc) => (sc.voice ? sc.id + ':' + (sc.say || sc.text) : '')).join('|') + project.ttsVoice + project.ttsSpeed;
  useEffect(() => {
    if (!restored) return;
    const t = setTimeout(() => syncRef.current(), 800);
    return () => clearTimeout(t);
  }, [voiceSig, restored]);
  const retryVoice = (id) => { voiceKeys.current.delete(id); syncRef.current(); };
  const previewVoice = async () => {
    engine.current.ensure();
    try {
      const p = projRef.current;
      const { pcm, sr } = await synthesize('Hi! This is how I will sound in your videos.', p.ttsVoice, p.ttsSpeed);
      engine.current.playOnce(toAudioBuffer(pcm, sr));
    } catch (err) { showToast('Voice preview failed: ' + (err.message || 'unknown error')); }
  };

  /* ---------- media loading ---------- */
  const attachVideoEl = async (id, blob) => {
    const old = assets.current.videos.get(id);
    if (old) { old.pause(); engine.current.unregisterVideo(id); URL.revokeObjectURL(old.src); }
    const v = await loadVideo(blob);
    v.addEventListener('seeked', () => { clock.current.dirty = true; });
    v.addEventListener('loadeddata', () => { clock.current.dirty = true; });
    assets.current.videos.set(id, v);
    engine.current.registerVideo(id, v);
    return v;
  };

  /* restore files saved in the browser */
  useEffect(() => {
    let alive = true;
    (async () => {
      const ids = new Set(projRef.current.scenes.map((sc) => sc.id));
      for (const f of await loadAllFiles()) {
        if (!alive) return;
        const [kind, id] = f.key.split(':');
        try {
          if ((kind === 'img' || kind === 'aud' || kind === 'vid') && !ids.has(id)) { deleteFile(f.key); continue; }
          if (kind === 'tts') {
            const used = projRef.current.scenes.some((sc) => sc.voiceKey === id);
            if (used) storedVoices.current.set(id, f.blob); else deleteFile(f.key);
            continue;
          }
          if (kind === 'bg') { assets.current.bgImg = await loadImage(f.blob); setFileName('bg', f.name); }
          else if (kind === 'logo') { assets.current.logo = await loadImage(f.blob); setLogoUrl(URL.createObjectURL(f.blob)); }
          else if (kind === 'img') assets.current.images.set(id, await loadImage(f.blob));
          else if (kind === 'vid') await attachVideoEl(id, f.blob);
          else if (kind === 'aud') engine.current.setCustom('scene:' + id, await engine.current.decode(f.blob));
          else if (kind === 'music' || kind === 'typing' || kind === 'whoosh') {
            engine.current.setCustom(kind, await engine.current.decode(f.blob));
            setFileName(kind, f.name);
          }
        } catch { /* skip a file that no longer opens */ }
      }
      if (alive) { bump(); setRestored(true); }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    engine.current.musicBuffer(project.music).catch(() => {});
    restartAudio();
  }, [project.music, project.musicVol, project.sfxVol, project.sfxTyping, project.sfxWhoosh, project.sceneVol, project.duck]);

  /* ---------- playback ---------- */
  const setPlaying = useCallback((v) => {
    const c = clock.current;
    if (v && c.t >= totalDuration(projRef.current) - 0.05) c.t = 0;
    c.playing = v;
    c.startAt = performance.now() - c.t * 1000;
    c.dirty = true;
    if (v) engine.current.start(projRef.current, c.t);
    else engine.current.stop();
    setPlayingState(v);
  }, []);
  const seek = useCallback((time) => {
    const c = clock.current;
    c.t = clamp(time, 0, totalDuration(projRef.current));
    c.startAt = performance.now() - c.t * 1000;
    c.dirty = true;
    if (c.playing && !exportRef.current) engine.current.start(projRef.current, c.t);
  }, []);
  const goScene = useCallback((k, keepPlaying) => {
    const p = projRef.current;
    let acc = 0;
    for (let j = 0; j < k; j++) acc += p.scenes[j].dur;
    if (!keepPlaying && clock.current.playing) setPlaying(false);
    const sc = p.scenes[k];
    if (sc) seek(acc + restTime(sc));
  }, [seek, setPlaying]);
  const selectScene = (k) => { setSel(k); goScene(k); };
  // jump to a scene once it exists (used right after adding, moving or deleting)
  const pendingGo = useRef(null);
  const goSoon = (k) => { pendingGo.current = k; };
  useEffect(() => {
    const k = pendingGo.current;
    if (k == null || !project.scenes[k]) return;
    pendingGo.current = null;
    goScene(k);
  }, [project, goScene]);

  /** Keep every video element in step with the timeline. */
  const syncVideos = (p, t, isPlaying) => {
    const vids = assets.current.videos;
    if (!vids.size) return;
    const { i } = sceneAt(p, t);
    let acc = 0;
    p.scenes.forEach((sc, k) => {
      const start = acc;
      acc += sc.dur;
      const v = vids.get(sc.id);
      if (!v || sc.type !== 'video') { if (v && !v.paused) v.pause(); return; }
      const rate = sc.rate || 1;
      const t0 = sc.trimStart || 0;
      if (k === i) {
        const end = isFinite(v.duration) && v.duration > 0 ? v.duration : sc.srcDur || 1e9;
        const target = t0 + Math.max(0, t - start) * rate;
        const tgt = Math.min(target, end - 0.04);
        if (v.playbackRate !== rate) v.playbackRate = rate;
        if (isPlaying && target < end) {
          if (v.paused) { if (Math.abs(v.currentTime - tgt) > 0.08) v.currentTime = tgt; v.play().catch(() => {}); }
          else if (Math.abs(v.currentTime - tgt) > 0.35) v.currentTime = tgt;
        } else {
          if (!v.paused) v.pause();
          if (!v.seeking && Math.abs(v.currentTime - tgt) > 0.05) v.currentTime = tgt;
        }
      } else {
        if (!v.paused) v.pause();
        if (k === i + 1 && !v.seeking && Math.abs(v.currentTime - t0) > 0.05) v.currentTime = t0; // ready for the cut
      }
    });
  };

  const finishExport = useRef(() => {});
  finishExport.current = () => {
    const r = exportRef.current;
    if (!r) return;
    setTimeout(() => { try { r.rec.stop(); } catch { /* ignore */ } }, 350);
  };

  /* ---------- render loop ---------- */
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    let raf;
    const tick = (now) => {
      const c = clock.current;
      const p = projRef.current;
      const tot = totalDuration(p);
      if (c.playing) {
        c.t = (now - c.startAt) / 1000;
        if (c.t >= tot) {
          c.t = tot;
          c.playing = false;
          setPlayingState(false);
          engine.current.stop();
          if (exportRef.current) finishExport.current();
        }
        c.dirty = true;
      }
      syncVideos(p, c.t, c.playing);
      if (c.dirty) {
        renderFrame(ctx, p, c.t, assets.current);
        if (tcRef.current) tcRef.current.textContent = fmtTime(c.t);
        if (headRef.current) headRef.current.style.left = (tot ? (c.t / tot) * 100 : 0) + '%';
        if (recTextRef.current) recTextRef.current.textContent = `Exporting ${Math.round((c.t / tot) * 100)}%  ·  keep this tab open`;
        const { i } = sceneAt(p, c.t);
        setActive((prev) => (prev === i ? prev : i));
        c.dirty = false;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    if (document.fonts) {
      Promise.all(FONTS.map((F) => document.fonts.load(`${F.weight} 80px "${F.family}"`))
        .concat(document.fonts.load('600 38px "Hanken Grotesk"'), document.fonts.load('400 30px "JetBrains Mono"')))
        .then(() => { clearLayoutCache(); clock.current.dirty = true; bump(); })
        .catch(() => {});
    }
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(TEXTAREA|INPUT|SELECT)$/.test(document.activeElement.tagName);
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !typing && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && !typing && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (e.code === 'Space' && !typing && document.activeElement.tagName !== 'BUTTON' && !exportRef.current && !result && !screenRef.current) {
        e.preventDefault();
        setPlaying(!clock.current.playing);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPlaying, result, undo, redo]);

  /* ---------- project edits ---------- */
  const checkpoint = () => { hist.current.last = 0; }; // the next change gets its own undo step
  const update = (patch) => setProject((p) => ({ ...p, ...patch }));
  const patchScene = (id, fn) => setProject((p) => ({ ...p, scenes: p.scenes.map((s) => (s.id === id ? fn(s) : s)) }));
  const updateScene = (k, sc) => setProject((p) => ({ ...p, scenes: p.scenes.map((s, j) => (j === k ? sc : s)) }));
  const changeType = (k, type) => { checkpoint(); setProject((p) => ({
    ...p,
    scenes: p.scenes.map((s, j) => {
      if (j !== k || s.type === type) return s;
      const fresh = newScene(type);
      return { ...fresh, id: s.id, text: s.text || fresh.text, voice: s.voice, say: s.say, imageName: s.imageName, videoName: s.videoName, srcDur: s.srcDur, nat: s.nat, hasAudio: s.hasAudio };
    }),
  })); };
  const moveScene = (k, d) => {
    checkpoint();
    setProject((p) => {
      const scenes = [...p.scenes];
      const j = k + d;
      [scenes[k], scenes[j]] = [scenes[j], scenes[k]];
      return { ...p, scenes };
    });
    setSel(k + d);
    goSoon(k + d);
  };
  // files stay in memory so Undo can bring a deleted scene back; unused ones are cleaned up on the next load
  const deleteScene = (k) => {
    checkpoint();
    setProject((p) => ({ ...p, scenes: p.scenes.filter((_, j) => j !== k) }));
    const next = Math.max(0, k - 1);
    setSel(next);
    goSoon(next);
  };
  const duplicateScene = (k) => {
    checkpoint();
    const src = projRef.current.scenes[k];
    const copy = { ...JSON.parse(JSON.stringify(src)), id: uid() };
    // share the same picture / video / audio
    const img = assets.current.images.get(src.id);
    if (img) assets.current.images.set(copy.id, img);
    const a = engine.current.getCustom('scene:' + src.id);
    if (a) engine.current.setCustom('scene:' + copy.id, a);
    setProject((p) => ({ ...p, scenes: [...p.scenes.slice(0, k + 1), copy, ...p.scenes.slice(k + 1)] }));
    const vid = assets.current.videos.get(src.id);
    if (vid) {
      fetch(vid.src).then((r) => r.blob()).then(async (b) => { await attachVideoEl(copy.id, b); saveFile('vid:' + copy.id, b); bump(); }).catch(() => {});
    }
    if (img) fetch(img.src).then((r) => r.blob()).then((b) => saveFile('img:' + copy.id, b)).catch(() => {});
    setSel(k + 1);
    goSoon(k + 1);
  };
  const addScene = (type) => {
    if (type === 'screen') { openScreen(null); return null; }
    const sc = { ...newScene(type), voice: !!projRef.current.ttsAuto && type === 'text' };
    const k = projRef.current.scenes.length;
    setProject((p) => ({ ...p, scenes: [...p.scenes, sc] }));
    setSel(k);
    goSoon(k);
    return sc;
  };

  /* images, videos, audio for a scene (by id, so they work right after a scene is added) */
  const setSceneImage = async (id, file) => {
    try {
      const img = await loadImage(file);
      assets.current.images.set(id, img);
      saveFile('img:' + id, file);
      patchScene(id, (s) => {
        const layout = { ...(s.layout || {}) };
        delete layout.media; // re-fit to the new picture
        return { ...s, type: 'image', imageName: file.name, nat: [img.width, img.height], layout, frame: s.frame || 'none', crop: null, cropAspect: null };
      });
      bump();
    } catch { showToast('That file could not be opened as an image. Try a PNG, JPG or WebP.'); }
  };
  /**
   * Apply a chosen area to a scene. A Short-shaped (9:16) area fills the whole video;
   * any other shape is fitted on the background.
   */
  const withCrop = (s, crop, aspect, fw, fh) => {
    const layout = { ...(s.layout || {}) };
    const tall = crop && Math.abs((crop.w * fw) / (crop.h * fh) - 9 / 16) < 0.03;
    if (tall) layout.media = { x: 0, y: 0, w: W, h: H };
    else delete layout.media;
    return { ...s, crop: crop || null, cropAspect: crop ? aspect : null, frame: crop ? 'none' : s.frame, layout };
  };

  const setSceneVideo = async (id, file, meta = {}) => {
    showToast('Loading video…');
    try {
      const v = await attachVideoEl(id, file);
      let d = await videoDuration(v);
      if (!d && meta.duration) d = meta.duration;
      const sound = meta.hasAudio ?? (await hasSound(file));
      saveFile('vid:' + id, file);
      const fw = v.videoWidth || 1920, fh = v.videoHeight || 1080;
      patchScene(id, (s) => {
        const layout = { ...(s.layout || {}) };
        if (!(layout.media && layout.media.x <= 0 && layout.media.w >= W)) delete layout.media; // keep "fill screen", re-fit otherwise
        let next = {
          ...newScene('video'), ...s, type: 'video', videoName: file.name, srcDur: Math.round(d * 10) / 10,
          nat: [fw, fh], trimStart: 0, rate: s.rate || 1,
          hasAudio: sound, videoAudio: sound, videoVol: s.videoVol ?? 100,
          dur: d ? clamp(half(d / (s.rate || 1)), 1, 180) : s.dur, layout, crop: null, cropAspect: null,
          ...(meta.frame ? { frame: meta.frame } : {}),
        };
        if (meta.crop) next = withCrop(next, meta.crop, meta.cropAspect, fw, fh);
        return next;
      });
      setToast('');
      bump();
    } catch (err) { showToast(err.message || 'That video could not be opened. Try an MP4 or WebM file.'); }
  };
  const AUDIO_ERR = 'That file could not be read as audio. Try an MP3, WAV, M4A or OGG.';
  const setSceneAudio = async (id, file) => {
    try {
      const buf = await engine.current.decode(file);
      engine.current.setCustom('scene:' + id, buf);
      saveFile('aud:' + id, file);
      patchScene(id, (s) => ({ ...s, audioName: file.name, audioDur: Math.round(buf.duration * 10) / 10 }));
      bump();
      setTimeout(restartAudio, 0);
    } catch { showToast(AUDIO_ERR); }
  };
  const clearSceneAudio = (id) => {
    engine.current.setCustom('scene:' + id, null);
    deleteFile('aud:' + id);
    patchScene(id, ({ audioName, audioDur, ...rest }) => rest);
    setTimeout(restartAudio, 0);
  };
  const fitToAudio = (k) => {
    const sc = projRef.current.scenes[k];
    const d = sc.audioName && engine.current.getCustom('scene:' + sc.id) ? sc.audioDur : sc.voice ? sc.voiceDur : 0;
    if (!d) return;
    updateScene(k, { ...sc, dur: clamp(Math.ceil((d + 0.5) * 2) / 2, 1, 180) });
  };
  /* ---------- crop an existing image or video ---------- */
  const [cropEdit, setCropEdit] = useState(null); // { id, source, initial, aspect }
  const openCrop = (id) => {
    const sc = projRef.current.scenes.find((s) => s.id === id);
    if (!sc) return;
    const v = assets.current.videos.get(id);
    const img = assets.current.images.get(id);
    const source = sc.type === 'video' && v ? { kind: 'video', url: v.src, time: (sc.trimStart || 0) + 0.05 }
      : img ? { kind: 'image', url: img.src } : null;
    if (!source) { showToast('Add an image or video to this scene first.'); return; }
    if (clock.current.playing) setPlaying(false);
    setCropEdit({ id, source, initial: sc.crop || null, aspect: sc.crop ? sc.cropAspect || 'free' : '9:16' });
  };
  const applyCrop = (rect, aspect) => {
    const { id } = cropEdit;
    setCropEdit(null);
    const sc = projRef.current.scenes.find((s) => s.id === id);
    if (!sc) return;
    const el = sc.type === 'video' ? assets.current.videos.get(id) : assets.current.images.get(id);
    const fw = (el && (el.videoWidth || el.naturalWidth || el.width)) || (sc.nat && sc.nat[0]) || 1920;
    const fh = (el && (el.videoHeight || el.naturalHeight || el.height)) || (sc.nat && sc.nat[1]) || 1080;
    checkpoint();
    patchScene(id, (s) => withCrop(s, rect, aspect, fw, fh));
  };
  const clearCrop = (id) => { checkpoint(); patchScene(id, (s) => withCrop(s, null, null, 1, 1)); };

  /** A file dropped on a scene card. */
  const dropOnScene = (id, file) => {
    if (file.type.startsWith('image/')) setSceneImage(id, file);
    else if (file.type.startsWith('video/')) setSceneVideo(id, file);
    else if (file.type.startsWith('audio/')) setSceneAudio(id, file);
    else showToast('Drop an image, a video or an audio file.');
  };
  /** Files dropped on the scene list (not on a card) become new scenes. */
  const dropNew = (fileList) => {
    [...fileList].forEach((file) => {
      const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;
      if (!type) { showToast('Drop images or videos to add them as scenes.'); return; }
      const sc = addScene(type);
      if (sc) (type === 'image' ? setSceneImage : setSceneVideo)(sc.id, file);
    });
  };

  const setBg = async (file) => {
    try { assets.current.bgImg = await loadImage(file); saveFile('bg', file); setFileName('bg', file.name); bump(); }
    catch { showToast('That file could not be opened as an image. Try a PNG or JPG.'); }
  };
  const clearBg = () => { assets.current.bgImg = null; deleteFile('bg'); setFileName('bg', null); bump(); };
  const setLogo = async (file) => {
    try { assets.current.logo = await loadImage(file); saveFile('logo', file); setLogoUrl(URL.createObjectURL(file)); bump(); }
    catch { showToast('That file could not be opened as an image. Try a PNG or JPG.'); }
  };
  const clearLogo = () => { assets.current.logo = null; deleteFile('logo'); setLogoUrl(''); bump(); };

  const setSoundFile = async (kind, file) => {
    try {
      engine.current.setCustom(kind, await engine.current.decode(file));
      saveFile(kind, file);
      setFileName(kind, file.name);
      if (kind === 'music') update({ music: 'file' });
      else if (kind === 'typing') update({ sfxTyping: true });
      else update({ sfxWhoosh: true });
      setTimeout(restartAudio, 0);
    } catch { showToast(AUDIO_ERR); }
  };
  const clearSoundFile = (kind) => {
    engine.current.setCustom(kind, null);
    deleteFile(kind);
    setFileName(kind, null);
    if (kind === 'music' && projRef.current.music === 'file') update({ music: 'none' });
    setTimeout(restartAudio, 0);
  };
  const replayScene = () => { const { start } = sceneAt(projRef.current, clock.current.t); seek(start); setPlaying(true); };

  /* ---------- the drag-and-resize editor ---------- */
  const activeScene = project.scenes[active];
  const stageLayout = activeScene ? sceneLayout(project, activeScene, { ...assets.current, live: null }) : {};
  const onLive = (key, box) => {
    assets.current.live = key && activeScene ? { id: activeScene.id, key, box } : null;
    clock.current.dirty = true;
  };
  const commitLayout = (key, box) => {
    if (!activeScene) return;
    checkpoint();
    patchScene(activeScene.id, (s) => ({ ...s, layout: { ...(s.layout || {}), [key]: box } }));
    setSel(active);
  };
  const layoutAction = (key, a) => {
    const sc = activeScene;
    if (!sc) return;
    const cur = stageLayout[key];
    checkpoint();
    patchScene(sc.id, (s) => {
      const layout = { ...(s.layout || {}) };
      let patch = {};
      if (a === 'reset') delete layout[key];
      else if (a === 'center') {
        if (cur.kind === 'text') layout[key] = { cx: W / 2, cy: Math.round(cur.cy), w: Math.round(cur.w), s: cur.s };
        else layout[key] = { x: Math.round((W - cur.w) / 2), y: Math.round(cur.y), w: Math.round(cur.w), h: Math.round(cur.h) };
      } else if (a === 'fill') {
        layout.media = { x: 0, y: 0, w: W, h: H };
        patch = { frame: 'none' };
      } else if (a === 'fit') {
        const [sw, sh] = naturalSize(s, assets.current);
        let w = Math.min(cur.w, W);
        let h = fittedHeight(s.frame || 'none', w, sw, sh);
        if (h > H) { w *= H / h; h = H; }
        layout.media = { x: Math.round(cur.x + cur.w / 2 - w / 2), y: Math.round(cur.y + cur.h / 2 - h / 2), w: Math.round(w), h: Math.round(h) };
      } else if (a === 'wide') {
        layout.media = { x: 40, y: Math.round(cur.y), w: W - 80, h: Math.round(cur.h) };
      }
      return { ...s, ...patch, layout };
    });
  };

  /* ---------- timeline ---------- */
  const tlRef = useRef(null);
  const dragging = useRef(false);
  const tlSeek = (e) => {
    const r = tlRef.current.getBoundingClientRect();
    seek(clamp((e.clientX - r.left) / r.width) * totalDuration(projRef.current));
  };

  /* ---------- screen recording ---------- */
  const openScreen = (targetId) => setScreen({ phase: 'dialog', target: targetId });
  const startScreen = async (opts) => {
    if (clock.current.playing) setPlaying(false);
    let session;
    try {
      session = await openScreenSession(opts);
    } catch (err) {
      setScreen(null);
      if (err && err.name === 'NotAllowedError') showToast('Screen recording cancelled.');
      else showToast('Screen recording could not start: ' + ((err && err.message) || 'unknown error'));
      return;
    }
    if (session.micDenied) showToast('The microphone was blocked, so only the screen and its sound are recorded.');
    const job = { ...screenRef.current, session, count: 3, cancelled: false, crop: null, cropAspect: null };
    screenJob.current = job;
    if (opts.area) {
      // step 2: pick the area on a live preview of what is shared
      setScreen({ ...job, phase: 'area' });
      const picked = await new Promise((resolve) => {
        job.resolveArea = resolve;
        session.done.then(() => resolve(null)); // sharing stopped from the browser
      });
      job.resolveArea = null;
      if (!picked || job.cancelled) {
        session.cancel();
        screenJob.current = null;
        setScreen(null);
        if (!job.cancelled) showToast('Screen recording cancelled.');
        return;
      }
      job.crop = picked.rect;
      job.cropAspect = picked.aspect;
    }
    setScreen({ ...job, phase: 'countdown' });
    for (let n = 3; n > 0; n--) {
      if (job.cancelled) return;
      setScreen((s) => (s ? { ...s, count: n } : s));
      await sleep(850);
    }
    if (job.cancelled) return;
    // clear the countdown first so not even its last frame is recorded
    setScreen((s) => (s ? { ...s, phase: 'starting' } : s));
    await sleep(350);
    if (job.cancelled) return;
    session.start();
    setScreen((s) => (s ? { ...s, phase: 'recording', hidden: !!opts.hideBar } : s));
    const res = await session.done;
    const target = job.target;
    setScreen(null);
    if (!res) { showToast('Screen recording discarded.'); return; }
    const name = `Screen recording ${new Date().toTimeString().slice(0, 5).replace(':', '.')}.${res.blob.type.includes('mp4') ? 'mp4' : 'webm'}`;
    const file = new File([res.blob], name, { type: res.blob.type });
    let id = target;
    if (!id || !projRef.current.scenes.some((s) => s.id === id)) {
      const sc = addScene('video');
      id = sc.id;
    } else {
      const k = projRef.current.scenes.findIndex((s) => s.id === id);
      setSel(k);
    }
    const cur = projRef.current.scenes.find((s) => s.id === id);
    const frame = job.crop ? 'none' : cur && cur.frame && cur.frame !== 'none' ? cur.frame : 'browser';
    await setSceneVideo(id, file, { duration: res.duration, hasAudio: res.hasAudio, crop: job.crop, cropAspect: job.cropAspect, frame });
    showToast(job.crop ? 'Screen recording added, showing just the area you picked. Use Crop area to change it.' : 'Screen recording added. Drag it on the preview to move, resize or zoom in.');
  };
  const cancelScreen = () => {
    const job = screenJob.current;
    if (job) { job.cancelled = true; if (job.resolveArea) job.resolveArea(null); job.session && job.session.cancel(); }
    screenJob.current = null;
    setScreen(null);
  };

  const recording = !!screen && screen.phase === 'recording';
  useEffect(() => {
    if (!recording) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setScreen((s) => (s && s.phase === 'recording' ? { ...s, hidden: !s.hidden } : s));
    };
    window.addEventListener('keydown', onKey);
    const title = document.title;
    const id = setInterval(() => {
      const s = screenRef.current;
      if (s && s.session) document.title = `● ${s.session.paused ? 'Paused' : 'Recording'} ${fmtTime(s.session.elapsed()).replace(/\.\d$/, '')} · Shortsmith`;
    }, 500);
    return () => { window.removeEventListener('keydown', onKey); clearInterval(id); document.title = title; };
  }, [recording]);

  /* ---------- templates ---------- */
  const applyTemplate = (t) => {
    if (clock.current.playing) setPlaying(false);
    setProject(t.make());
    setShowTemplates(false);
    setSel(0);
    setEdSel(null);
    goSoon(0);
    showToast(`“${t.name}” loaded. Undo (Ctrl+Z) brings your previous project back.`);
  };

  /* ---------- export ---------- */
  const startExport = async () => {
    if (exportRef.current) {
      exportRef.current.cancelled = true;
      setPlaying(false);
      try { exportRef.current.rec.stop(); } catch { /* ignore */ }
      return;
    }
    const mime = pickMime();
    const canvas = canvasRef.current;
    if (!mime || !canvas.captureStream) { showToast('This browser cannot export video. Use Chrome, Edge or Safari on a computer.'); return; }
    const p = projRef.current;
    if (total > 180) showToast('Heads up: over 3 minutes. Shorts allows up to 3:00, Reels up to 3:00, TikTok longer.');
    if (p.music === 'file' && !engine.current.userBuffer) showToast('No music file is loaded. Choose one under Audio → Music to include it.');
    const missing = p.scenes.filter((s) => (s.type === 'video' && !assets.current.videos.has(s.id)) || (s.type === 'image' && !assets.current.images.has(s.id)));
    if (missing.length) showToast(`${missing.length} scene${missing.length > 1 ? 's have' : ' has'} no image or video yet, so a placeholder will be exported.`);
    setEdSel(null);
    engine.current.ensure();
    try { await engine.current.musicBuffer(p.music); } catch { /* export without music */ }
    if (p.scenes.some((sc) => sc.voice)) {
      showToast('Getting voiceovers ready…');
      await syncRef.current();
      for (let i = 0; pendingVoices.current > 0 && i < 600; i++) await sleep(300);
    }
    const video = canvas.captureStream(30);
    const audioTracks = engine.current.stream ? engine.current.stream.getAudioTracks() : [];
    const stream = new MediaStream([...video.getVideoTracks(), ...audioTracks]);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10_000_000, audioBitsPerSecond: 192_000 });
    const chunks = [];
    const job = { rec, cancelled: false };
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      video.getVideoTracks().forEach((tr) => tr.stop());
      exportRef.current = null;
      setExporting(false);
      if (job.cancelled) { showToast('Export stopped. Nothing was saved.'); return; }
      const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type: mime.split(';')[0] });
      setResult((old) => { if (old) URL.revokeObjectURL(old.url); return { blob, ext, url: URL.createObjectURL(blob) }; });
    };
    exportRef.current = job;
    setExporting(true);
    setPlaying(false);
    seek(0);
    rec.start(250);
    setTimeout(() => setPlaying(true), 150);
  };

  const firstText = (project.scenes[0]?.text || 'video').replace(/\*/g, '');
  const slug = firstText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'video';
  const h = hist.current;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <div className="mark" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M5 3.2v9.6L13 8z" fill="#1f1400" /></svg></div>
          <div><h1>Shortsmith <span className="ver">v7.1</span></h1><small>Vertical video editor for Shorts, Reels & TikTok</small></div>
        </div>
        <div className="top-right">
          <button className="btn ghost" type="button" onClick={() => setShowTemplates(true)}>
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.3" fill="currentColor" /><rect x="9" y="1.5" width="5.5" height="5.5" rx="1.3" fill="none" stroke="currentColor" strokeWidth="1.4" /><rect x="1.5" y="9" width="5.5" height="5.5" rx="1.3" fill="none" stroke="currentColor" strokeWidth="1.4" /><rect x="9" y="9" width="5.5" height="5.5" rx="1.3" fill="currentColor" /></svg>
            Templates
          </button>
          <div className="undo-group">
            <button className="icon-btn" type="button" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!h.past.length} onClick={undo}>
              <svg width="16" height="16" viewBox="0 0 16 16"><path d="M5.5 3.5L2.5 6.5l3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 6.5h6.5a4 4 0 0 1 0 8H7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
            <button className="icon-btn" type="button" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!h.future.length} onClick={redo}>
              <svg width="16" height="16" viewBox="0 0 16 16"><path d="M10.5 3.5l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M13 6.5H6.5a4 4 0 0 0 0 8H9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          </div>
          <span className={'chip' + (total > 180 ? ' warn' : '')}><b>{fmtTime(total)}</b> · {project.scenes.length} scenes</span>
          <button className="btn primary" type="button" onClick={startExport}>
            {exporting ? <><span className="dot" /> Stop export</> : <><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M2.5 13.5h11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> Export video</>}
          </button>
        </div>
      </header>

      <main className="work">
        <section className="panel" aria-labelledby="scriptH"
          onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) dropNew(e.dataTransfer.files); }}>
          <div className="panel-head">
            <h2 id="scriptH">Scenes</h2>
            <span className="hint">Drop images or videos here to add them</span>
          </div>
          <div className="scenes">
            {project.scenes.map((sc, k) => (
              <SceneCard key={sc.id} scene={sc} index={k} count={project.scenes.length}
                expanded={k === sel} active={k === active && playing}
                onExpand={() => selectScene(k)}
                onChange={(s) => { updateScene(k, s); if (k !== active) goScene(k, true); }}
                onType={(type) => { changeType(k, type); goSoon(k); }}
                onMove={(d) => moveScene(k, d)}
                onDelete={() => deleteScene(k)}
                onDuplicate={() => duplicateScene(k)}
                onFocus={() => { if (k !== active) goScene(k); }}
                hasImage={assets.current.images.has(sc.id)}
                onImage={(f) => setSceneImage(sc.id, f)}
                hasVideo={assets.current.videos.has(sc.id)}
                onVideo={(f) => setSceneVideo(sc.id, f)}
                canRecord={canRecord}
                onRecordScreen={() => openScreen(sc.id)}
                onDropFile={(f) => dropOnScene(sc.id, f)}
                onCrop={() => openCrop(sc.id)}
                onClearCrop={() => clearCrop(sc.id)}
                hasAudio={!!engine.current.getCustom('scene:' + sc.id)}
                onAudio={(f) => setSceneAudio(sc.id, f)}
                onClearAudio={() => clearSceneAudio(sc.id)}
                onFitAudio={() => fitToAudio(k)}
                voiceStatus={voiceStatus[sc.id]}
                model={model}
                onRetryVoice={() => retryVoice(sc.id)} />
            ))}
          </div>
          <div className="add-label">Add a scene</div>
          <div className="add-grid">
            {ADD_TILES.filter(([id]) => id !== 'screen' || canRecord).map(([id, label, note]) => (
              <button key={id} type="button" className={'add-tile t-' + id} onClick={() => addScene(id)}>
                <span className="ico"><TypeIcon type={id} size={16} /></span>
                <span className="txt"><b>{label}</b><small>{note}</small></span>
              </button>
            ))}
          </div>
        </section>

        <section className="stage" aria-label="Preview">
          <div className="stage-inner">
            <div className="phone-wrap">
              <div className="phone">
                <canvas ref={canvasRef} width={W} height={H} aria-label="Video preview" />
                {project.safe && (
                  <div className="safe">
                    <div className="rail"><i /><i /><i /><i /></div>
                    <span className="rail-label">Buttons</span>
                    <div className="band"><span>Title & caption</span></div>
                  </div>
                )}
                {exporting && (
                  <div className="recov"><div className="pill"><span className="dot" /><span ref={recTextRef}>Exporting 0%</span></div></div>
                )}
              </div>
              {activeScene && (
                <StageEditor layout={stageLayout} sceneId={activeScene.id} sceneType={activeScene.type}
                  playing={playing} disabled={exporting}
                  onPause={() => setPlaying(false)} onLive={onLive} onCommit={commitLayout} onAction={layoutAction}
                  selected={edSel} setSelected={(k) => { setEdSel(k); if (k) setSel(active); }} />
              )}
            </div>
            <p className="stage-hint">{edSel ? 'Drag to move · corners resize · edges crop · arrow keys nudge' : 'Click anything on the preview to move or resize it'}</p>
            <div className="transport">
              <div className="trow">
                <button className="play" type="button" aria-label={playing ? 'Pause' : 'Play'} disabled={exporting} onClick={() => setPlaying(!playing)}>
                  {playing
                    ? <svg width="16" height="16" viewBox="0 0 16 16"><rect x="3.5" y="2.5" width="3.2" height="11" rx="1" fill="currentColor" /><rect x="9.3" y="2.5" width="3.2" height="11" rx="1" fill="currentColor" /></svg>
                    : <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 2.5v11L13.5 8z" fill="currentColor" /></svg>}
                </button>
                <div className="tc"><b ref={tcRef}>0:01.0</b> / <span>{fmtTime(total)}</span></div>
                <div className="spacer" />
                <button className="btn small" type="button" disabled={exporting} onClick={() => { seek(0); setPlaying(true); }}>↺ From start</button>
              </div>
              <div className="timeline" ref={tlRef}
                onPointerDown={(e) => { if (exporting) return; dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); if (clock.current.playing) setPlaying(false); tlSeek(e); }}
                onPointerMove={(e) => { if (dragging.current) tlSeek(e); }}
                onPointerUp={() => { dragging.current = false; setSel(sceneAt(projRef.current, clock.current.t).i); }}>
                {project.scenes.map((sc, k) => (
                  <div key={sc.id} className={'seg' + (k === active ? ' active' : '') + ' t-' + sc.type} style={{ flex: `${sc.dur} 1 0` }}>
                    <TypeIcon type={sc.type} size={10} /> {(sc.text || '').replace(/\*/g, '') || sc.videoName || sc.imageName || sc.filename || '—'}
                  </div>
                ))}
                <div className="playhead" ref={headRef} />
              </div>
            </div>
          </div>
        </section>

        <LookPanel project={project} update={update} onReplay={replayScene} files={files}
          onBg={setBg} onClearBg={clearBg} onSound={setSoundFile} onClearSound={clearSoundFile}
          model={model} onPreviewVoice={previewVoice}
          onVoiceAll={(on) => update({ scenes: projRef.current.scenes.map((sc) => (sc.type === 'text' ? { ...sc, voice: on } : sc)) })}
          logoUrl={logoUrl} onLogo={setLogo} onClearLogo={clearLogo} />
      </main>

      {result && <ResultModal result={result} length={fmtTime(total)} fileName={`${slug}.${result.ext}`} onClose={() => setResult(null)} />}
      {showTemplates && <TemplatesModal onPick={applyTemplate} onClose={() => setShowTemplates(false)} />}
      {screen && screen.phase === 'dialog' && <ScreenDialog initial={{}} onStart={startScreen} onClose={() => setScreen(null)} />}
      {screen && screen.phase === 'countdown' && <Countdown n={screen.count} onCancel={cancelScreen} />}
      {screen && screen.phase === 'area' && (
        <CropSelector source={{ kind: 'stream', stream: screen.session.stream }}
          title="Choose the area to record"
          note="This is a live view of what you shared. Drag the frame over the part you want and resize it from the corners. Only this area will be in the video, and you can change it later."
          confirmLabel="Start recording"
          onConfirm={(rect, aspect) => screenJob.current && screenJob.current.resolveArea && screenJob.current.resolveArea({ rect, aspect })}
          onCancel={cancelScreen} />
      )}
      {screen && screen.phase === 'recording' && (
        <RecBar session={screen.session} crop={screen.crop} hidden={!!screen.hidden}
          onHide={() => setScreen((s) => (s ? { ...s, hidden: true } : s))}
          onStop={() => screen.session.stop()} onCancel={cancelScreen} />
      )}
      {cropEdit && (
        <CropSelector source={cropEdit.source} initial={cropEdit.initial} initialAspect={cropEdit.aspect}
          title="Crop area"
          note="Choose which part of the picture to show. Short 9:16 fills the whole video. Nothing is deleted, so you can change this any time."
          confirmLabel="Apply"
          onConfirm={applyCrop} onCancel={() => setCropEdit(null)} />
      )}
      {toast && !(screen && (screen.phase === 'recording' || screen.phase === 'starting')) && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
