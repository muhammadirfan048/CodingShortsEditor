import React, { useEffect, useRef, useState } from 'react';
import { fmtTime } from '../renderer.js';

/** Step 1: choose what to capture. */
export function ScreenDialog({ initial, onStart, onClose }) {
  const [mic, setMic] = useState(initial.mic ?? true);
  const [sys, setSys] = useState(initial.systemAudio ?? true);
  const [area, setArea] = useState(initial.area ?? true);
  const [hideBar, setHideBar] = useState(() => { try { return localStorage.getItem('shortsmith-hidebar') !== '0'; } catch { return true; } });
  const pickHide = (v) => { setHideBar(v); try { localStorage.setItem('shortsmith-hidebar', v ? '1' : '0'); } catch { /* ignore */ } };
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="srH" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet sr-sheet">
        <div className="sheet-head">
          <div>
            <h3 id="srH">Record your screen</h3>
            <p>Capture a product, website or tool in action. The recording becomes a video scene you can trim, speed up, crop and resize.</p>
          </div>
          <button type="button" className="icon-btn big" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className="sr-choice" role="radiogroup" aria-label="What to record">
          <button type="button" role="radio" aria-checked={area} className={'sr-card' + (area ? ' on' : '')} onClick={() => setArea(true)}>
            <span className="sr-ill area" aria-hidden="true"><i /></span>
            <b>An area</b>
            <small>Drag a Short-size frame over part of your screen. Only that part is in the video.</small>
          </button>
          <button type="button" role="radio" aria-checked={!area} className={'sr-card' + (!area ? ' on' : '')} onClick={() => setArea(false)}>
            <span className="sr-ill full" aria-hidden="true"><i /></span>
            <b>Everything shared</b>
            <small>The whole tab, window or screen, shown in a browser frame.</small>
          </button>
        </div>
        <div className="sr-opts">
          <label className="switch" htmlFor="srMic">
            <span><b>Microphone</b><br /><small>Talk over the recording</small></span>
            <input type="checkbox" id="srMic" checked={mic} onChange={(e) => setMic(e.target.checked)} />
          </label>
          <label className="switch" htmlFor="srSys">
            <span><b>Tab or system sound</b><br /><small>Sound from what you record (when the browser allows it)</small></span>
            <input type="checkbox" id="srSys" checked={sys} onChange={(e) => setSys(e.target.checked)} />
          </label>
          <label className="switch" htmlFor="srHide">
            <span><b>Hide controls while recording</b><br /><small>Nothing from Shortsmith shows up in your recording. Press <kbd>Esc</kbd> here to bring them back.</small></span>
            <input type="checkbox" id="srHide" checked={hideBar} onChange={(e) => pickHide(e.target.checked)} />
          </label>
        </div>
        <ol className="sr-steps">
          <li>Your browser asks which <b>tab, window or screen</b> to share.</li>
          {area && <li>A live preview opens. <b>Drag and resize the frame</b> over the part you want, then press Start.</li>}
          <li>A 3-second countdown starts, then recording begins.</li>
          {hideBar
            ? <li>To stop, use the browser’s <b>Stop sharing</b> button, or come back here and press <kbd>Esc</kbd> for the controls.</li>
            : <li>Stop with the red bar here, or the browser’s <b>Stop sharing</b> button.</li>}
        </ol>
        <div className="actions">
          <button type="button" className="btn primary" onClick={() => onStart({ mic, systemAudio: sys, area, hideBar })}><span className="dot light" /> Choose what to record</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
        <p className="hint" style={{ marginTop: 12 }}>Tip: for a sharp result, make the area at least about 600 px wide on your screen, and zoom the page you record (Ctrl +) so text is big. You can change the area after recording with Crop area.</p>
      </div>
    </div>
  );
}

/** Big 3-2-1 before recording starts. */
export function Countdown({ n, onCancel }) {
  return (
    <div className="countdown" role="status" aria-live="assertive">
      <div className="cd-num" key={n}>{n}</div>
      <p>Recording starts…</p>
      <button type="button" className="btn" onClick={onCancel}>Cancel</button>
    </div>
  );
}

/** A small live view of exactly what is being recorded (the chosen area). */
function LivePeek({ stream, crop, size }) {
  const ref = useRef(null);
  const ar = crop ? (crop.w * size[0]) / (crop.h * size[1]) : size[0] / size[1];
  const h = 64;
  const w = Math.round(Math.min(120, h * ar));
  useEffect(() => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.srcObject = new MediaStream(stream.getVideoTracks());
    v.play().catch(() => {});
    let raf;
    const draw = () => {
      const c = ref.current;
      if (c && v.videoWidth) {
        const k = crop || { x: 0, y: 0, w: 1, h: 1 };
        c.getContext('2d').drawImage(v, k.x * v.videoWidth, k.y * v.videoHeight, k.w * v.videoWidth, k.h * v.videoHeight, 0, 0, c.width, c.height);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); v.srcObject = null; };
  }, [stream, crop]);
  return <canvas ref={ref} className="rb-peek" width={w * 2} height={Math.round((w / ar) * 2)} style={{ width: w, height: Math.round(w / ar) }} aria-label="What is being recorded" />;
}

/** Floating controls while recording. */
export function RecBar({ session, crop, hidden, onHide, onStop, onCancel }) {
  const [, tick] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);
  if (hidden) return <span className="sr-only" role="status">Recording. Press Escape to show the controls.</span>;
  return (
    <div className="recbar" role="status">
      {session.stream && <LivePeek stream={session.stream} crop={crop} size={session.size} />}
      <span className={'dot' + (paused ? ' still' : '')} />
      <span className="rb-label">{paused ? 'Paused' : 'Recording screen'}</span>
      <span className="rb-time">{fmtTime(session.elapsed())}</span>
      <button type="button" className="btn small" onClick={() => { if (paused) session.resume(); else session.pause(); setPaused(!paused); }}>
        {paused ? 'Resume' : 'Pause'}
      </button>
      <button type="button" className="btn small primary" onClick={onStop}>■ Stop & add</button>
      <button type="button" className="btn small ghost" onClick={onCancel}>Discard</button>
      <button type="button" className="icon-btn rb-hide" title="Hide controls (Esc shows them again)" aria-label="Hide controls" onClick={onHide}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z" fill="none" stroke="currentColor" strokeWidth="1.4" /><circle cx="8" cy="8" r="2" fill="currentColor" /><path d="M2.5 13.5l11-11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}
