import React, { useEffect, useRef, useState } from 'react';
import { W, H } from '../renderer.js';

/*
  Sits on top of the preview. Lets you click a part of the scene (text, caption,
  image, video, code or terminal box), drag it, and resize it with handles.
  Coordinates are in video pixels (1080 × 1920); the overlay is scaled with CSS.
*/

const SNAP = 14; // video px
const MARGIN = 40;

const CORNERS = ['nw', 'ne', 'sw', 'se'];
const EDGES = ['n', 's', 'e', 'w'];

function handlesFor(el) {
  if (el.kind === 'text') return [...CORNERS, 'e', 'w'];
  return [...CORNERS, ...EDGES];
}

/** Turn a stored text box into a rectangle and back. */
const textRect = (t) => ({ x: t.cx - t.w / 2, y: t.cy - t.h / 2, w: t.w, h: t.h });

export default function StageEditor({ layout, sceneId, sceneType, playing, disabled, onPause, onLive, onCommit, onAction, selected, setSelected }) {
  const wrapRef = useRef(null);
  const drag = useRef(null);
  const [live, setLive] = useState(null); // { key, el } while dragging
  const [guides, setGuides] = useState({ v: false, h: false });

  // forget the selection when the scene changes
  useEffect(() => { setSelected(null); }, [sceneId]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = [];
  if (layout.media) items.push(['media', layout.media]);
  if (layout.caption) items.push(['caption', layout.caption]);
  if (layout.text) items.push(['text', layout.text]);

  const elOf = (key) => (live && live.key === key ? live.el : (items.find(([k]) => k === key) || [])[1]);

  /* ---------- dragging ---------- */
  const begin = (e, key, mode) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    if (playing) onPause();
    const el = elOf(key);
    if (!el) return;
    setSelected(key);
    const rect = wrapRef.current.getBoundingClientRect();
    drag.current = { key, mode, k: W / rect.width, sx: e.clientX, sy: e.clientY, start: { ...el }, rect, moved: false };
    wrapRef.current.setPointerCapture(e.pointerId);
  };

  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) * d.k;
    const dy = (e.clientY - d.sy) * d.k;
    if (!d.moved && Math.hypot(dx, dy) < 3) return;
    d.moved = true;
    const s = d.start;
    const isText = s.kind === 'text';
    let el = { ...s };
    let g = { v: false, h: false };

    if (d.mode === 'move') {
      if (isText) {
        let cx = s.cx + dx, cy = s.cy + dy;
        if (!e.altKey) {
          if (Math.abs(cx - W / 2) < SNAP) { cx = W / 2; g.v = true; }
          if (Math.abs(cy - H / 2) < SNAP) { cy = H / 2; g.h = true; }
        }
        el = { ...s, cx, cy, x: cx - s.w / 2, y: cy - s.h / 2 };
      } else {
        let x = s.x + dx, y = s.y + dy;
        if (!e.altKey) {
          const cx = x + s.w / 2, cy = y + s.h / 2;
          if (Math.abs(cx - W / 2) < SNAP) { x = W / 2 - s.w / 2; g.v = true; }
          else if (Math.abs(x - MARGIN) < SNAP) x = MARGIN;
          else if (Math.abs(x) < SNAP) x = 0;
          else if (Math.abs(x + s.w - (W - MARGIN)) < SNAP) x = W - MARGIN - s.w;
          else if (Math.abs(x + s.w - W) < SNAP) x = W - s.w;
          if (Math.abs(cy - H / 2) < SNAP) { y = H / 2 - s.h / 2; g.h = true; }
          else if (Math.abs(y) < SNAP) y = 0;
          else if (Math.abs(y + s.h - H) < SNAP) y = H - s.h;
        }
        el = { ...s, x, y };
      }
    } else if (isText) {
      const h = d.mode;
      if (h === 'e' || h === 'w') {
        // change the wrap width, symmetric around the centre
        const px = (h === 'e' ? 1 : -1) * dx;
        const w = Math.max(220, s.w + px * 2);
        el = { ...s, w, x: s.cx - w / 2 };
      } else {
        // corners scale the text around its centre
        const r0 = d.rect;
        const cxs = r0.left + (s.cx / W) * r0.width, cys = r0.top + (s.cy / H) * r0.height;
        const d0 = Math.hypot(d.sx - cxs, d.sy - cys) || 1;
        const d1 = Math.hypot(e.clientX - cxs, e.clientY - cys);
        const f = Math.max(0.25, Math.min(4, d1 / d0));
        const sNew = Math.max(0.25, Math.min(2.5, s.s * f));
        const fw = sNew / s.s;
        el = { ...s, s: sNew, w: s.w * fw, h: s.h * fw, x: s.cx - (s.w * fw) / 2, y: s.cy - (s.h * fw) / 2 };
      }
    } else {
      const h = d.mode;
      const keepRatio = (s.kind === 'image' || s.kind === 'video') && h.length === 2 && !e.shiftKey;
      let { x, y, w, h: hh } = s;
      const minW = s.kind === 'code' || s.kind === 'terminal' ? 320 : 120;
      const minH = s.kind === 'code' || s.kind === 'terminal' ? 220 : 120;
      if (h.includes('e')) w = Math.max(minW, s.w + dx);
      if (h.includes('w')) { w = Math.max(minW, s.w - dx); x = s.x + s.w - w; }
      if (h.includes('s')) hh = Math.max(minH, s.h + dy);
      if (h.includes('n')) { hh = Math.max(minH, s.h - dy); y = s.y + s.h - hh; }
      if (keepRatio) {
        const ratio = s.w / s.h;
        const f = Math.max(w / s.w, hh / s.h);
        w = Math.max(minW, s.w * f); hh = w / ratio;
        x = h.includes('w') ? s.x + s.w - w : s.x;
        y = h.includes('n') ? s.y + s.h - hh : s.y;
      }
      el = { ...s, x, y, w, h: hh };
    }
    setGuides(g);
    setLive({ key: d.key, el });
    onLive(d.key, toStored(el));
  };

  const end = () => {
    const d = drag.current;
    drag.current = null;
    setGuides({ v: false, h: false });
    if (!d) return;
    if (d.moved && live && live.key === d.key) onCommit(d.key, toStored(live.el));
    setLive(null);
    onLive(null);
  };

  /* ---------- keyboard nudging ---------- */
  useEffect(() => {
    const onKey = (e) => {
      if (!selected || disabled) return;
      if (/^(TEXTAREA|INPUT|SELECT)$/.test(document.activeElement.tagName)) return;
      if (e.key === 'Escape') { setSelected(null); return; }
      const step = e.shiftKey ? 25 : 5;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!d) return;
      e.preventDefault();
      const el = elOf(selected);
      if (!el) return;
      const moved = el.kind === 'text'
        ? { ...el, cx: el.cx + d[0], cy: el.cy + d[1] }
        : { ...el, x: el.x + d[0], y: el.y + d[1] };
      onCommit(selected, toStored(moved));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const pct = (v, of) => (v / of) * 100 + '%';
  const sel = selected ? elOf(selected) : null;

  return (
    <div
      ref={wrapRef}
      className={'stage-edit' + (playing ? ' is-playing' : '') + (disabled ? ' is-off' : '')}
      onPointerMove={onMove}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
    >
      {items.map(([key, base]) => {
        const el = elOf(key) || base;
        const r = el.kind === 'text' ? textRect(el) : el;
        const isSel = selected === key;
        return (
          <div
            key={key}
            className={'ed-el ed-' + el.kind + (isSel ? ' sel' : '')}
            style={{ left: pct(r.x, W), top: pct(r.y, H), width: pct(r.w, W), height: pct(r.h, H) }}
            onPointerDown={(e) => begin(e, key, 'move')}
            title={labelFor(key, sceneType)}
          >
            {isSel && !playing && handlesFor(el).map((h) => (
              <span key={h} className={'ed-h ed-h-' + h} onPointerDown={(e) => begin(e, key, h)} />
            ))}
            {isSel && !drag.current && <span className="ed-tag">{labelFor(key, sceneType)}</span>}
          </div>
        );
      })}

      {guides.v && <div className="ed-guide v" />}
      {guides.h && <div className="ed-guide h" />}

      {sel && !playing && !live && (
        <Toolbar el={sel} keyName={selected} sceneType={sceneType} onAction={(a) => onAction(selected, a)} />
      )}
    </div>
  );
}

/** What gets saved in scene.layout. */
function toStored(el) {
  if (!el) return null;
  if (el.kind === 'text') return { cx: Math.round(el.cx), cy: Math.round(el.cy), w: Math.round(el.w), s: Math.round(el.s * 1000) / 1000 };
  return { x: Math.round(el.x), y: Math.round(el.y), w: Math.round(el.w), h: Math.round(el.h) };
}

function labelFor(key, type) {
  if (key === 'text') return 'Text';
  if (key === 'caption') return 'Caption';
  return { image: 'Image', video: 'Video', code: 'Code box', terminal: 'Terminal' }[type] || 'Media';
}

function Toolbar({ el, keyName, sceneType, onAction }) {
  const r = el.kind === 'text' ? textRect(el) : el;
  const above = r.y + r.h > H - 220 && r.y > 160; // below the item unless it sits near the bottom
  const top = above ? r.y : r.y + r.h;
  const left = Math.min(Math.max(r.x + r.w / 2, 260), W - 260);
  const media = keyName === 'media';
  const pic = media && (sceneType === 'image' || sceneType === 'video');
  const B = (a, label, title) => (
    <button key={a} type="button" title={title} onPointerDown={(e) => e.stopPropagation()} onClick={() => onAction(a)}>{label}</button>
  );
  return (
    <div className={'ed-bar' + (above ? ' above' : ' below')} style={{ left: (left / W) * 100 + '%', top: (top / H) * 100 + '%' }}>
      {pic && B('fill', 'Fill screen', 'Cover the whole video')}
      {pic && B('fit', 'Fit', 'Show the whole picture again (undo cropping)')}
      {media && !pic && B('wide', 'Full width', 'Use the full width')}
      {B('center', 'Center', 'Centre horizontally')}
      {B('reset', 'Reset', 'Back to the automatic layout')}
    </div>
  );
}
