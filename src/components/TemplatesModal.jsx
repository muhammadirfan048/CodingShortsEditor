import React, { useEffect, useRef } from 'react';
import { TEMPLATES } from '../presets.js';
import { renderFrame } from '../renderer.js';

/** Draws a template's second scene (or first) as a small live thumbnail. */
function Thumb({ make }) {
  const ref = useRef(null);
  useEffect(() => {
    const p = make();
    const ctx = ref.current.getContext('2d');
    const k = Math.min(1, p.scenes.length - 1);
    let t = 0;
    for (let j = 0; j < k; j++) t += p.scenes[j].dur;
    t += Math.min(1.6, p.scenes[k].dur * 0.8);
    const draw = () => {
      ctx.setTransform(ref.current.width / 1080, 0, 0, ref.current.height / 1920, 0, 0);
      renderFrame(ctx, p, t, { images: new Map(), videos: new Map() });
    };
    draw();
    if (document.fonts) document.fonts.ready.then(draw).catch(() => {});
  }, [make]);
  return <canvas ref={ref} width={216} height={384} aria-hidden="true" />;
}

export default function TemplatesModal({ onPick, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="tplH" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet tpl-sheet">
        <div className="sheet-head">
          <div>
            <h3 id="tplH">Start from a template</h3>
            <p>Each one is a ready-made structure. Swap in your own text, screenshots and clips. This replaces the current project (Undo brings it back).</p>
          </div>
          <button type="button" className="icon-btn big" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className="tpl-grid">
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" className="tpl" onClick={() => onPick(t)}>
              <Thumb make={t.make} />
              <b>{t.name}</b>
              <span>{t.note}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
