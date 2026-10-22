import React, { useEffect, useRef, useState } from 'react';

/*
  Pick part of a picture: a live screen share, a video or an image.
  The area is returned as fractions of the source ({ x, y, w, h } from 0 to 1),
  so it works at any resolution and can be changed later.
*/

export const ASPECTS = [
  ['9:16', 'Short 9:16', 9 / 16],
  ['4:5', '4:5', 4 / 5],
  ['1:1', 'Square', 1],
  ['16:9', 'Wide 16:9', 16 / 9],
  ['free', 'Free', null],
  ['full', 'Whole', 'full'],
];
const ratioOf = (id) => (ASPECTS.find((a) => a[0] === id) || ASPECTS[0])[2];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MIN = 0.06;

/** The biggest centred area of a given pixel ratio. */
function fitRect(ratio, nw, nh, around) {
  if (ratio === 'full' || !nw) return { x: 0, y: 0, w: 1, h: 1 };
  if (!ratio) return around || { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
  const rN = (ratio * nh) / nw; // width / height in fractions
  let h = 1, w = rN;
  if (w > 1) { w = 1; h = 1 / rN; }
  const cx = around ? around.x + around.w / 2 : 0.5;
  const cy = around ? around.y + around.h / 2 : 0.5;
  return { x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h), w, h };
}

export default function CropSelector({ source, initial, initialAspect = '9:16', title, note, confirmLabel = 'Done', onConfirm, onCancel }) {
  const mediaRef = useRef(null);
  const boxRef = useRef(null);
  const stageRef = useRef(null);
  const [room, setRoom] = useState([900, 500]); // space available for the picture, in CSS px
  const drag = useRef(null);
  const [nat, setNat] = useState(null); // [w, h] in source pixels
  const [aspect, setAspect] = useState(initialAspect);
  const [rect, setRect] = useState(initial || null);

  /* measure the space so the picture keeps its exact shape */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setRoom([Math.max(200, el.clientWidth - 28), Math.max(200, Math.min(window.innerHeight * 0.6, 720))]);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  /* load the picture */
  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (source.kind === 'stream') {
      el.srcObject = new MediaStream(source.stream.getVideoTracks());
      el.play().catch(() => {});
    }
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if (source.kind === 'stream') el.srcObject = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onMeta = () => {
    const el = mediaRef.current;
    const w = el.videoWidth || el.naturalWidth;
    const h = el.videoHeight || el.naturalHeight;
    if (!w) return;
    setNat([w, h]);
    if (source.kind === 'video' && source.time) el.currentTime = source.time;
    setRect((r) => r || fitRect(ratioOf(initialAspect), w, h));
  };

  const ratio = ratioOf(aspect);
  const locked = ratio && ratio !== 'full';
  const pickAspect = (id) => {
    setAspect(id);
    if (nat) setRect((r) => fitRect(ratioOf(id), nat[0], nat[1], r)); // keeps the centre; Free keeps the area
  };

  /* dragging */
  const begin = (e, mode) => {
    e.preventDefault();
    e.stopPropagation();
    if (!rect) return;
    if (aspect === 'full') setAspect(mode === 'move' ? 'full' : 'free');
    const b = boxRef.current.getBoundingClientRect();
    drag.current = { mode, b, sx: e.clientX, sy: e.clientY, s: { ...rect } };
    boxRef.current.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d || !nat) return;
    const dx = (e.clientX - d.sx) / d.b.width;
    const dy = (e.clientY - d.sy) / d.b.height;
    const s = d.s;
    if (d.mode === 'move') {
      setRect({ ...s, x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h) });
      return;
    }
    const m = d.mode;
    let x0 = s.x, y0 = s.y, x1 = s.x + s.w, y1 = s.y + s.h;
    if (m.includes('w')) x0 = clamp(s.x + dx, 0, x1 - MIN);
    if (m.includes('e')) x1 = clamp(x1 + dx, x0 + MIN, 1);
    if (m.includes('n')) y0 = clamp(s.y + dy, 0, y1 - MIN);
    if (m.includes('s')) y1 = clamp(y1 + dy, y0 + MIN, 1);
    if (locked) {
      const rN = (ratio * nat[1]) / nat[0];
      let w = x1 - x0;
      let h = w / rN;
      const availH = m.includes('n') ? s.y + s.h : 1 - s.y;
      if (h > availH) { h = availH; w = h * rN; }
      if (w < MIN) { w = MIN; h = w / rN; }
      if (m.includes('w')) { x1 = s.x + s.w; x0 = x1 - w; } else { x0 = s.x; x1 = x0 + w; }
      if (m.includes('n')) { y1 = s.y + s.h; y0 = y1 - h; } else { y0 = s.y; y1 = y0 + h; }
      if (x0 < 0) { x0 = 0; x1 = w; }
      if (x1 > 1) { x1 = 1; x0 = 1 - w; }
    }
    setRect({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  };
  const end = () => { drag.current = null; };

  const px = nat && rect ? [Math.round(rect.w * nat[0]), Math.round(rect.h * nat[1])] : null;
  const soft = px && aspect !== 'full' && (px[0] < 540 || px[1] < 760);
  const handles = locked ? ['nw', 'ne', 'sw', 'se'] : ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
  const mediaProps = { ref: mediaRef, className: 'crop-media', draggable: false };
  const ar = nat ? nat[0] / nat[1] : 16 / 9;
  const boxW = Math.floor(Math.min(room[0], room[1] * ar));
  const boxH = Math.floor(boxW / ar);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="cropH">
      <div className="sheet crop-sheet">
        <div className="sheet-head">
          <div>
            <h3 id="cropH">{title}</h3>
            {note && <p>{note}</p>}
          </div>
          <button type="button" className="icon-btn big" aria-label="Close" onClick={onCancel}>×</button>
        </div>

        <div className="crop-aspects seg-ctl" role="group" aria-label="Shape">
          {ASPECTS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={aspect === id} onClick={() => pickAspect(id)}>{label}</button>
          ))}
        </div>

        <div className="crop-stage" ref={stageRef}>
          <div ref={boxRef} className="crop-box" style={{ width: boxW, height: boxH }}
            onPointerMove={onMove} onPointerUp={end} onPointerCancel={end}>
            {source.kind === 'image'
              ? <img {...mediaProps} src={source.url} alt="" onLoad={onMeta} />
              : <video {...mediaProps} src={source.kind === 'video' ? source.url : undefined} muted playsInline autoPlay={source.kind === 'stream'}
                  preload="auto" onLoadedMetadata={onMeta} />}
            {!nat && <div className="crop-wait">Loading the picture…</div>}
            {rect && nat && (
              <div className={'crop-rect' + (locked ? ' locked' : '')} onPointerDown={(e) => begin(e, 'move')}
                style={{ left: rect.x * 100 + '%', top: rect.y * 100 + '%', width: rect.w * 100 + '%', height: rect.h * 100 + '%' }}>
                <i className="third v1" /><i className="third v2" /><i className="third h1" /><i className="third h2" />
                {handles.map((h) => <span key={h} className={'ed-h ed-h-' + h} onPointerDown={(e) => begin(e, h)} />)}
              </div>
            )}
          </div>
        </div>

        <div className="crop-foot">
          <span className="hint">
            {px ? <>Area: <b>{px[0]} × {px[1]}</b> px of {nat[0]} × {nat[1]}</> : ' '}
            {soft && <> · <span className="warn-text">small area, the video may look soft</span></>}
          </span>
          <div className="actions">
            <button type="button" className="btn" onClick={onCancel}>Cancel</button>
            <button type="button" className="btn primary" disabled={!rect || !nat}
              onClick={() => onConfirm(aspect === 'full' ? null : roundRect(rect), aspect)}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const r4 = (v) => Math.round(v * 10000) / 10000;
const roundRect = (r) => ({ x: r4(r.x), y: r4(r.y), w: r4(r.w), h: r4(r.h) });
