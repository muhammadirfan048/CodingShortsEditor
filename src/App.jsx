import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SAMPLE_PROJECT, FONTS, newScene, uid } from './presets.js';
import { renderFrame, totalDuration, sceneAt, fmtTime, clearLayoutCache, clamp, W, H } from './renderer.js';
import SceneCard from './components/SceneCard.jsx';
import LookPanel from './components/LookPanel.jsx';
import ResultModal from './components/ResultModal.jsx';
import { AudioEngine } from './audio.js';
import { saveFile, deleteFile, loadAllFiles } from './store.js';
import { synthesize, speakableText, voiceKey, toAudioBuffer, toWav, onModelProgress } from './tts.js';

const STORAGE_KEY = 'shortsmith-project-v2';

function loadProject() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && Array.isArray(saved.scenes) && saved.scenes.length) {
      saved.scenes = saved.scenes.map((s) => ({ ...newScene(s.type || 'text'), ...s, id: s.id || uid() }));
      return { ...SAMPLE_PROJECT, ...saved };
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

const loadImage = (file) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('bad image'));
  img.src = URL.createObjectURL(file);
});

export default function App() {
  const [project, setProject] = useState(loadProject);
  const projRef = useRef(project);
  projRef.current = project;

  const assets = useRef({ bgImg: null, images: new Map() });
  const engine = useRef(null);
  if (!engine.current) engine.current = new AudioEngine();
  // names of uploaded project-wide files: bg, music, typing, whoosh
  const [files, setFiles] = useState({});
  const [imgTick, setImgTick] = useState(0);
  const setFileName = (key, name) => setFiles((f) => { const n = { ...f }; if (name) n[key] = name; else delete n[key]; return n; });

  const canvasRef = useRef(null);
  const tcRef = useRef(null);
  const headRef = useRef(null);
  const recTextRef = useRef(null);
  const clock = useRef({ t: 1.2, playing: false, startAt: 0, dirty: true });
  const [playing, setPlayingState] = useState(false);
  const [active, setActive] = useState(0);
  const [recording, setRecording] = useState(false);
  const recRef = useRef(null);
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState('');
  // automatic voiceovers
  const [voiceStatus, setVoiceStatus] = useState({}); // sceneId -> 'working' | 'ready' | 'error'
  const [model, setModel] = useState(null); // null | { pct, mb } while downloading | 'loaded'
  const [restored, setRestored] = useState(false);
  const voiceKeys = useRef(new Map()); // sceneId -> voice key loaded into the engine
  const voiceCache = useRef(new Map()); // voice key -> AudioBuffer
  const storedVoices = useRef(new Map()); // voice key -> saved WAV blob
  const pendingVoices = useRef(0);

  const total = totalDuration(project);

  /* persistence */
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); } catch { /* ignore */ }
    clock.current.dirty = true;
  }, [project]);
  useEffect(() => { clock.current.dirty = true; }, [imgTick]);
  const restartAudio = () => { if (clock.current.playing && !recRef.current) engine.current.start(projRef.current, clock.current.t); };

  /* ---------- automatic voiceovers ---------- */
  useEffect(() => onModelProgress((m) => {
    if (m.type === 'loaded') setModel('loaded');
    else setModel((old) => (old === 'loaded' ? old : { pct: m.total ? Math.round((m.loaded / m.total) * 100) : 0, mb: Math.round(m.total / 1e6) }));
  }), []);

  const setVStatus = (id, st) => setVoiceStatus((v) => ({ ...v, [id]: st }));

  /** Make sure every scene with voiceover on has its voice generated and loaded. */
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
      voiceKeys.current.set(sc.id, key); // claim it so it isn't made twice
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
        if (voiceKeys.current.get(sc.id) !== key) return; // text changed meanwhile
        engine.current.setCustom('tts:' + sc.id, buf);
        const vd = Math.round(buf.duration * 10) / 10;
        setProject((prev) => ({
          ...prev,
          scenes: prev.scenes.map((s) => {
            if (s.id !== sc.id) return s;
            const need = Math.ceil((vd + 0.5) * 2) / 2; // voice + a short pause
            return { ...s, voiceKey: key, voiceDur: vd, dur: s.dur < need ? clamp(need, 1, 60) : s.dur };
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

  // re-make voices shortly after the text, voice or speed changes
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
      const { pcm, sr } = await synthesize('Hi! This is how I will sound in your Shorts.', p.ttsVoice, p.ttsSpeed);
      engine.current.playOnce(toAudioBuffer(pcm, sr));
    } catch (err) { showToast('Voice preview failed: ' + (err.message || 'unknown error')); }
  };

  /* restore uploaded files saved in the browser */
  useEffect(() => {
    let alive = true;
    (async () => {
      const ids = new Set(projRef.current.scenes.map((sc) => sc.id));
      for (const f of await loadAllFiles()) {
        if (!alive) return;
        const [kind, id] = f.key.split(':');
        try {
          if ((kind === 'img' || kind === 'aud') && !ids.has(id)) { deleteFile(f.key); continue; }
          if (kind === 'tts') {
            const used = projRef.current.scenes.some((sc) => sc.voiceKey === id);
            if (used) storedVoices.current.set(id, f.blob); else deleteFile(f.key);
            continue;
          }
          if (kind === 'bg') { assets.current.bgImg = await loadImage(f.blob); setFileName('bg', f.name); }
          else if (kind === 'img') assets.current.images.set(id, await loadImage(f.blob));
          else if (kind === 'aud') engine.current.setCustom('scene:' + id, await engine.current.decode(f.blob));
          else if (kind === 'music' || kind === 'typing' || kind === 'whoosh') {
            engine.current.setCustom(kind, await engine.current.decode(f.blob));
            setFileName(kind, f.name);
          }
        } catch { /* skip a file that no longer decodes */ }
      }
      if (alive) { setImgTick((n) => n + 1); setRestored(true); }
    })();
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    engine.current.musicBuffer(project.music).catch(() => {});
    if (clock.current.playing && !recRef.current) engine.current.start(projRef.current, clock.current.t);
  }, [project.music, project.musicVol, project.sfxVol, project.sfxTyping, project.sfxWhoosh, project.sceneVol, project.duck]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setToast(''), 3800);
  }, []);

  /* playback */
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
    if (c.playing && !recRef.current) engine.current.start(projRef.current, c.t);
  }, []);
  const goScene = useCallback((k, keepPlaying) => {
    const p = projRef.current;
    let acc = 0;
    for (let j = 0; j < k; j++) acc += p.scenes[j].dur;
    if (!keepPlaying && clock.current.playing) setPlaying(false);
    const sc = p.scenes[k];
    if (sc) seek(acc + Math.min(sc.type === 'code' || sc.type === 'terminal' ? sc.dur * 0.8 : 1.4, sc.dur * 0.8));
  }, [seek, setPlaying]);

  /* recording helpers (ref so the render loop can call the latest version) */
  const finishRec = useRef(() => {});
  finishRec.current = () => {
    const r = recRef.current;
    if (!r) return;
    setTimeout(() => { try { r.rec.stop(); } catch { /* ignore */ } }, 350);
  };

  /* render loop */
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
          if (recRef.current) finishRec.current();
        }
        c.dirty = true;
      }
      if (c.dirty) {
        renderFrame(ctx, p, c.t, assets.current);
        if (tcRef.current) tcRef.current.textContent = fmtTime(c.t);
        if (headRef.current) headRef.current.style.left = (tot ? (c.t / tot) * 100 : 0) + '%';
        if (recTextRef.current) recTextRef.current.textContent = `REC ${Math.round((c.t / tot) * 100)}%  ·  keep this tab open`;
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
        .then(() => { clearLayoutCache(); clock.current.dirty = true; })
        .catch(() => {});
    }
    return () => cancelAnimationFrame(raf);
  }, []);

  /* keyboard */
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && !/^(TEXTAREA|INPUT|SELECT|BUTTON|A)$/.test(document.activeElement.tagName) && !recRef.current && !result) {
        e.preventDefault();
        setPlaying(!clock.current.playing);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPlaying, result]);

  /* project edits */
  const update = (patch) => setProject((p) => ({ ...p, ...patch }));
  const updateScene = (k, sc) => setProject((p) => ({ ...p, scenes: p.scenes.map((s, j) => (j === k ? sc : s)) }));
  const changeType = (k, type) => setProject((p) => ({
    ...p,
    scenes: p.scenes.map((s, j) => {
      if (j !== k || s.type === type) return s;
      const fresh = newScene(type);
      return { ...fresh, id: s.id, text: s.text || fresh.text };
    }),
  }));
  const moveScene = (k, d) => {
    setProject((p) => {
      const scenes = [...p.scenes];
      const j = k + d;
      [scenes[k], scenes[j]] = [scenes[j], scenes[k]];
      return { ...p, scenes };
    });
    setTimeout(() => goScene(k + d), 0);
  };
  const deleteScene = (k) => {
    const id = project.scenes[k].id;
    assets.current.images.delete(id);
    engine.current.setCustom('scene:' + id, null);
    engine.current.setCustom('tts:' + id, null);
    voiceKeys.current.delete(id);
    deleteFile('img:' + id);
    deleteFile('aud:' + id);
    setProject((p) => ({ ...p, scenes: p.scenes.filter((_, j) => j !== k) }));
    setTimeout(() => goScene(Math.max(0, k - 1)), 0);
  };
  const addScene = (type) => {
    setProject((p) => ({ ...p, scenes: [...p.scenes, { ...newScene(type), voice: !!p.ttsAuto && type === 'text' }] }));
    setTimeout(() => goScene(projRef.current.scenes.length - 1), 0);
  };
  const setSceneImage = async (k, file) => {
    try {
      const img = await loadImage(file);
      const sc = projRef.current.scenes[k];
      assets.current.images.set(sc.id, img);
      saveFile('img:' + sc.id, file);
      updateScene(k, { ...sc, imageName: file.name });
      setImgTick((n) => n + 1);
      goScene(k);
    } catch { showToast('That file could not be opened as an image. Try a PNG or JPG.'); }
  };
  const setBg = async (file) => {
    try { assets.current.bgImg = await loadImage(file); saveFile('bg', file); setFileName('bg', file.name); setImgTick((n) => n + 1); }
    catch { showToast('That file could not be opened as an image. Try a PNG or JPG.'); }
  };
  const clearBg = () => { assets.current.bgImg = null; deleteFile('bg'); setFileName('bg', null); setImgTick((n) => n + 1); };

  const AUDIO_ERR = 'That file could not be read as audio. Try an MP3, WAV, M4A or OGG.';
  /** kind = 'music' | 'typing' | 'whoosh' */
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
  const setSceneAudio = async (k, file) => {
    try {
      const buf = await engine.current.decode(file);
      const sc = projRef.current.scenes[k];
      engine.current.setCustom('scene:' + sc.id, buf);
      saveFile('aud:' + sc.id, file);
      updateScene(k, { ...sc, audioName: file.name, audioDur: Math.round(buf.duration * 10) / 10 });
      setImgTick((n) => n + 1);
      setTimeout(restartAudio, 0);
    } catch { showToast(AUDIO_ERR); }
  };
  const clearSceneAudio = (k) => {
    const sc = projRef.current.scenes[k];
    engine.current.setCustom('scene:' + sc.id, null);
    deleteFile('aud:' + sc.id);
    const { audioName, audioDur, ...rest } = sc;
    updateScene(k, rest);
    setTimeout(restartAudio, 0);
  };
  const fitToAudio = (k) => {
    const sc = projRef.current.scenes[k];
    const d = sc.audioName && engine.current.getCustom('scene:' + sc.id) ? sc.audioDur : sc.voice ? sc.voiceDur : 0;
    if (!d) return;
    updateScene(k, { ...sc, dur: clamp(Math.ceil((d + 0.5) * 2) / 2, 1, 60) });
  };
  const replayScene = () => { const { start } = sceneAt(projRef.current, clock.current.t); seek(start); setPlaying(true); };

  /* timeline drag */
  const tlRef = useRef(null);
  const dragging = useRef(false);
  const tlSeek = (e) => {
    const r = tlRef.current.getBoundingClientRect();
    seek(clamp((e.clientX - r.left) / r.width) * totalDuration(projRef.current));
  };

  /* recording */
  const startRecording = async () => {
    if (recRef.current) {
      recRef.current.cancelled = true;
      setPlaying(false);
      try { recRef.current.rec.stop(); } catch { /* ignore */ }
      return;
    }
    const mime = pickMime();
    const canvas = canvasRef.current;
    if (!mime || !canvas.captureStream) { showToast('This browser cannot record video. Use Chrome, Edge or Safari on a computer.'); return; }
    if (total > 180) showToast('Heads up: over 3:00, so YouTube will treat it as a normal video, not a Short.');
    const p = projRef.current;
    if (p.music === 'file' && !engine.current.userBuffer) showToast('No music file is loaded. Choose one under Music to include it.');
    engine.current.ensure();
    try { await engine.current.musicBuffer(p.music); } catch { /* record without music */ }
    if (p.scenes.some((sc) => sc.voice)) {
      showToast('Getting voiceovers ready…');
      await syncRef.current();
      for (let i = 0; pendingVoices.current > 0 && i < 600; i++) await new Promise((r) => setTimeout(r, 300));
    }
    const video = canvas.captureStream(30);
    const audioTracks = engine.current.stream ? engine.current.stream.getAudioTracks() : [];
    const stream = new MediaStream([...video.getVideoTracks(), ...audioTracks]);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10_000_000, audioBitsPerSecond: 192_000 });
    const chunks = [];
    const job = { rec, cancelled: false };
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      video.getVideoTracks().forEach((tr) => tr.stop()); // keep the audio track alive for the next recording
      recRef.current = null;
      setRecording(false);
      if (job.cancelled) { showToast('Recording stopped. Nothing was saved.'); return; }
      const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type: mime.split(';')[0] });
      setResult((old) => { if (old) URL.revokeObjectURL(old.url); return { blob, ext, url: URL.createObjectURL(blob) }; });
    };
    recRef.current = job;
    setRecording(true);
    setPlaying(false);
    seek(0);
    rec.start(250);
    setTimeout(() => setPlaying(true), 120);
  };

  const firstText = (project.scenes[0]?.text || 'short').replace(/\*/g, '');
  const slug = firstText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'short';

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <div className="mark" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M5 3.2v9.6L13 8z" fill="#1f1400" /></svg></div>
          <div><h1>Shortsmith <span className="ver">v5</span></h1><small>Text · Code · Terminal · Screenshot scenes, with music and automatic voiceovers</small></div>
        </div>
        <div className="top-right">
          <span className={'chip' + (total > 180 ? ' warn' : '')}><b>{fmtTime(total)}</b> · {project.scenes.length} scenes · Shorts max 3:00</span>
          <button className="btn primary" type="button" onClick={startRecording}>
            {recording ? <><span className="dot" /> Stop recording</> : <><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="currentColor" /></svg> Record video</>}
          </button>
        </div>
      </header>

      <main className="work">
        <section className="panel" aria-labelledby="scriptH">
          <div className="panel-head">
            <h2 id="scriptH">Script</h2>
            <span className="hint">Wrap words in <code>*stars*</code> to highlight</span>
          </div>
          <div className="scenes">
            {project.scenes.map((sc, k) => (
              <SceneCard key={sc.id} scene={sc} index={k} count={project.scenes.length} active={k === active}
                hasImage={assets.current.images.has(sc.id)}
                onChange={(s) => { updateScene(k, s); goScene(k, true); }}
                onType={(type) => { changeType(k, type); setTimeout(() => goScene(k), 0); }}
                onMove={(d) => moveScene(k, d)}
                onDelete={() => deleteScene(k)}
                onFocus={() => goScene(k)}
                onImage={(f) => setSceneImage(k, f)}
                hasAudio={!!engine.current.getCustom('scene:' + sc.id)}
                onAudio={(f) => setSceneAudio(k, f)}
                onClearAudio={() => clearSceneAudio(k)}
                onFitAudio={() => fitToAudio(k)}
                voiceStatus={voiceStatus[sc.id]}
                model={model}
                onRetryVoice={() => retryVoice(sc.id)} />
            ))}
          </div>
          <div className="add-row">
            <button className="btn add" type="button" onClick={() => addScene('text')}>+ Text</button>
            <button className="btn add" type="button" onClick={() => addScene('code')}>+ Code</button>
            <button className="btn add" type="button" onClick={() => addScene('terminal')}>+ Terminal</button>
            <button className="btn add" type="button" onClick={() => addScene('image')}>+ Screenshot</button>
          </div>
        </section>

        <section className="stage" aria-label="Preview">
          <div className="stage-inner">
            <div className="phone">
              <canvas ref={canvasRef} width={W} height={H} aria-label="Short preview" />
              {project.safe && (
                <div className="safe">
                  <div className="rail"><i /><i /><i /><i /></div>
                  <span className="rail-label">Buttons</span>
                  <div className="band"><span>Title & channel</span></div>
                </div>
              )}
              {recording && (
                <div className="recov"><div className="pill"><span className="dot" /><span ref={recTextRef}>REC 0%</span></div></div>
              )}
            </div>
            <div className="transport">
              <div className="trow">
                <button className="play" type="button" aria-label={playing ? 'Pause' : 'Play'} disabled={recording} onClick={() => setPlaying(!playing)}>
                  {playing
                    ? <svg width="16" height="16" viewBox="0 0 16 16"><rect x="3.5" y="2.5" width="3.2" height="11" rx="1" fill="currentColor" /><rect x="9.3" y="2.5" width="3.2" height="11" rx="1" fill="currentColor" /></svg>
                    : <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 2.5v11L13.5 8z" fill="currentColor" /></svg>}
                </button>
                <div className="tc"><b ref={tcRef}>0:01.2</b> / <span>{fmtTime(total)}</span></div>
                <div className="spacer" />
                <button className="btn small" type="button" disabled={recording} onClick={() => { seek(0); setPlaying(true); }}>↺ Start</button>
              </div>
              <div className="timeline" ref={tlRef}
                onPointerDown={(e) => { if (recording) return; dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); if (clock.current.playing) setPlaying(false); tlSeek(e); }}
                onPointerMove={(e) => { if (dragging.current) tlSeek(e); }}
                onPointerUp={() => { dragging.current = false; }}>
                {project.scenes.map((sc, k) => (
                  <div key={sc.id} className={'seg' + (k === active ? ' active' : '') + ' t-' + sc.type} style={{ flex: `${sc.dur} 1 0` }}>
                    {sc.type === 'code' ? '</> ' : sc.type === 'terminal' ? '>_ ' : sc.type === 'image' ? '▣ ' : ''}{sc.audioName || sc.voice ? '♪ ' : ''}{(sc.text || '').replace(/\*/g, '') || sc.filename || '—'}
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
          onVoiceAll={(on) => update({ scenes: projRef.current.scenes.map((sc) => (sc.type === 'text' ? { ...sc, voice: on } : sc)) })} />
      </main>

      {result && <ResultModal result={result} length={fmtTime(total)} fileName={`${slug}.${result.ext}`} onClose={() => setResult(null)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
