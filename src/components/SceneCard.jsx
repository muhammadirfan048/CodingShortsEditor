import React, { useRef, useState } from 'react';
import { LANGS, SCENE_TYPES, FRAMES } from '../presets.js';
import { fmtTime } from '../renderer.js';

const Up = () => <svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 3l5 6H3z" fill="currentColor" /></svg>;
const Down = () => <svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 13L3 7h10z" fill="currentColor" /></svg>;
const Del = () => <svg width="14" height="14" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
const Dup = () => <svg width="14" height="14" viewBox="0 0 16 16"><rect x="5" y="5" width="8.5" height="8.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M3 10.5V3.8C3 3.3 3.3 3 3.8 3h6.7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
const Mic = () => <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="1.5" width="5" height="8.5" rx="2.5" fill="currentColor" /><path d="M3 7.5a5 5 0 0 0 10 0M8 12.5V15" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>;

export function TypeIcon({ type, size = 14 }) {
  const p = { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true };
  if (type === 'image') return <svg {...p}><rect x="1.5" y="2.5" width="13" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="5.5" cy="6.5" r="1.4" fill="currentColor" /><path d="M2.5 12l3.8-3.6 2.4 2.2 2.2-2 2.6 3.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>;
  if (type === 'video') return <svg {...p}><rect x="1.5" y="3" width="9.5" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M11 7l3.5-2v6L11 9z" fill="currentColor" /></svg>;
  if (type === 'code') return <svg {...p}><path d="M5.5 4L1.8 8l3.7 4M10.5 4l3.7 4-3.7 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (type === 'terminal') return <svg {...p}><rect x="1.5" y="2.5" width="13" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M4.5 6.5l2 1.6-2 1.6M8 10h3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (type === 'screen') return <svg {...p}><rect x="1.5" y="2.5" width="13" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M5.5 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="8" cy="7" r="2" fill="currentColor" /></svg>;
  return <svg {...p}><path d="M3 3.5h10M8 3.5v9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

const SPEEDS = [0.5, 1, 1.5, 2, 3];

function Seg({ items, value, onPick }) {
  return (
    <div className="seg-ctl tight">
      {items.map(([id, label]) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onPick(id)}>{label}</button>
      ))}
    </div>
  );
}

export default function SceneCard(props) {
  const {
    scene, index, count, expanded, active, onExpand, onChange, onType, onMove, onDelete, onDuplicate, onFocus,
    hasImage, onImage, hasVideo, onVideo, onRecordScreen, canRecord, onDropFile, onCrop, onClearCrop,
    hasAudio, onAudio, onClearAudio, onFitAudio, voiceStatus, model, onRetryVoice,
  } = props;
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [dropping, setDropping] = useState(false);
  const set = (patch) => onChange({ ...scene, ...patch });
  const step = (d) => set({ dur: Math.min(180, Math.max(1, Math.round((scene.dur + d) * 2) / 2)) });
  const summary = (scene.text || '').replace(/\*/g, '').trim()
    || scene.imageName || scene.videoName || scene.filename || scene.command || ({ image: 'Image', video: 'Video' }[scene.type] || 'Untitled');
  const typeLabel = (SCENE_TYPES.find(([id]) => id === scene.type) || [0, 'Text'])[1];

  const dropProps = {
    onDragOver: (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropping(true); } },
    onDragLeave: () => setDropping(false),
    onDrop: (e) => { e.preventDefault(); e.stopPropagation(); setDropping(false); const f = e.dataTransfer.files[0]; if (f) onDropFile(f); },
  };

  /* ---------- collapsed ---------- */
  if (!expanded) {
    return (
      <div className={'scene collapsed' + (active ? ' playing' : '') + (dropping ? ' dropping' : '')} onClick={onExpand} {...dropProps}
        role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onExpand(); } }}>
        <span className="num">{String(index + 1).padStart(2, '0')}</span>
        <span className={'type-pill t-' + scene.type}><TypeIcon type={scene.type} size={12} />{typeLabel}</span>
        <span className="sum">{summary}</span>
        {(scene.voice || hasAudio) && <span className="ind" title="Has voice or audio"><Mic /></span>}
        <span className="dur-mini">{scene.dur.toFixed(1)}s</span>
        <button className="icon-btn" type="button" aria-label="Delete scene" disabled={count < 2}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}><Del /></button>
      </div>
    );
  }

  const videoInfo = scene.srcDur ? `${scene.videoName || 'Video'} · ${fmtTime(scene.srcDur)}` : scene.videoName;

  /* ---------- expanded ---------- */
  return (
    <div className={'scene' + (active ? ' playing' : '') + ' open' + (dropping ? ' dropping' : '')} {...dropProps}>
      <div className="scene-top">
        <span className="num">Scene {String(index + 1).padStart(2, '0')}</span>
        <span className="spacer" />
        <button className="icon-btn" type="button" aria-label="Move up" title="Move up" disabled={index === 0} onClick={() => onMove(-1)}><Up /></button>
        <button className="icon-btn" type="button" aria-label="Move down" title="Move down" disabled={index === count - 1} onClick={() => onMove(1)}><Down /></button>
        <button className="icon-btn" type="button" aria-label="Duplicate scene" title="Duplicate" onClick={onDuplicate}><Dup /></button>
        <button className="icon-btn" type="button" aria-label="Delete scene" title="Delete" disabled={count < 2} onClick={onDelete}><Del /></button>
      </div>
      <div className="type-tabs" role="group" aria-label="Scene type">
        {SCENE_TYPES.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={scene.type === id} title={label} onClick={() => onType(id)}>
            <TypeIcon type={id} size={13} /><span>{label}</span>
          </button>
        ))}
      </div>

      {scene.type === 'text' && (
        <textarea id={`text-${scene.id}`} rows={2} value={scene.text} aria-label="Scene text" placeholder="What should this scene say?"
          onFocus={onFocus} onChange={(e) => set({ text: e.target.value })} />
      )}

      {scene.type !== 'text' && (
        <input className="field" id={`cap-${scene.id}`} value={scene.text} onFocus={onFocus}
          placeholder={`Caption (optional). Use *stars* to highlight`}
          onChange={(e) => set({ text: e.target.value })} />
      )}

      {/* ---------- image ---------- */}
      {scene.type === 'image' && (
        <>
          <div className={'drop' + (hasImage ? ' has' : '')} onClick={() => fileRef.current?.click()} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click(); }}>
            <TypeIcon type="image" size={18} />
            <span>{hasImage ? <><b>{scene.imageName}</b> · click to replace</> : scene.imageName ? <>Add <b>{scene.imageName}</b> again</> : <><b>Choose an image</b> or drop it here · PNG, JPG, WebP</>}</span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; if (f) onImage(f); e.target.value = ''; }} />
          {hasImage && <CropRow scene={scene} onCrop={onCrop} onClearCrop={onClearCrop} />}
          <FrameRow scene={scene} set={set} onFocus={onFocus} />
          <label className="check">
            <input type="checkbox" checked={scene.zoom ?? true} onChange={(e) => set({ zoom: e.target.checked })} />
            Slow zoom
          </label>
        </>
      )}

      {/* ---------- video ---------- */}
      {scene.type === 'video' && (
        <>
          <div className="video-src">
            <div className={'drop' + (hasVideo ? ' has' : '')} onClick={() => videoRef.current?.click()} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') videoRef.current?.click(); }}>
              <TypeIcon type="video" size={18} />
              <span>{hasVideo ? <><b>{videoInfo}</b> · click to replace</> : scene.videoName ? <>Add <b>{scene.videoName}</b> again</> : <><b>Upload a video</b> or drop it here · MP4, WebM, MOV</>}</span>
            </div>
            {canRecord && (
              <button type="button" className="btn small rec-btn" onClick={onRecordScreen}><span className="dot" /> Record screen</button>
            )}
          </div>
          <input ref={videoRef} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files[0]; if (f) onVideo(f); e.target.value = ''; }} />
          {hasVideo && <CropRow scene={scene} onCrop={onCrop} onClearCrop={onClearCrop} />}
          <FrameRow scene={scene} set={set} onFocus={onFocus} />
          <div className="grid2">
            <div className="mini-field">
              <span className="mini-label">Speed</span>
              <Seg items={SPEEDS.map((s) => [s, s + '×'])} value={scene.rate || 1} onPick={(r) => set({ rate: r })} />
            </div>
            <div className="mini-field">
              <span className="mini-label">Start from <output>{fmtTime(scene.trimStart || 0)}</output></span>
              <input type="range" min="0" max={Math.max(0, (scene.srcDur || 0) - 0.5)} step="0.1" value={scene.trimStart || 0}
                disabled={!scene.srcDur} onChange={(e) => set({ trimStart: +e.target.value })} aria-label="Start the video from" />
            </div>
          </div>
          <div className="row-between">
            <label className="check">
              <input type="checkbox" checked={scene.videoAudio !== false} disabled={scene.hasAudio === false}
                onChange={(e) => set({ videoAudio: e.target.checked })} />
              {scene.hasAudio === false ? 'This video has no sound' : 'Use the video’s sound'}
            </label>
            {scene.srcDur > 0 && (
              <button type="button" className="link-btn" onClick={() => set({ dur: Math.min(180, Math.max(1, Math.round(((scene.srcDur - (scene.trimStart || 0)) / (scene.rate || 1)) * 2) / 2)) })}>
                Match video length
              </button>
            )}
          </div>
          {scene.videoAudio !== false && scene.hasAudio !== false && (
            <input type="range" min="0" max="150" step="5" value={scene.videoVol ?? 100} aria-label="Video volume"
              onChange={(e) => set({ videoVol: +e.target.value })} />
          )}
        </>
      )}

      {/* ---------- code ---------- */}
      {scene.type === 'code' && (
        <>
          <div className="code-meta">
            <select className="field" value={scene.lang} onChange={(e) => set({ lang: e.target.value })} aria-label="Language">
              {LANGS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            <input className="field mono" value={scene.filename} placeholder="filename.js" aria-label="File name"
              onFocus={onFocus} onChange={(e) => set({ filename: e.target.value })} />
          </div>
          <textarea className="code" id={`code-${scene.id}`} rows={7} spellCheck={false} value={scene.code} aria-label="Code"
            onFocus={onFocus} onChange={(e) => set({ code: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                const el = e.target, s = el.selectionStart, en = el.selectionEnd;
                const v = scene.code.slice(0, s) + '  ' + scene.code.slice(en);
                set({ code: v });
                requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; });
              }
            }} />
          <label className="check">
            <input type="checkbox" checked={!!scene.typing} onChange={(e) => set({ typing: e.target.checked })} />
            Type the code out letter by letter
          </label>
        </>
      )}

      {/* ---------- terminal ---------- */}
      {scene.type === 'terminal' && (
        <>
          <div className="code-meta">
            <div className="cmd">
              <span>$</span>
              <input className="field mono" id={`cmd-${scene.id}`} value={scene.command} placeholder="node index.js" aria-label="Command"
                spellCheck={false} onFocus={onFocus} onChange={(e) => set({ command: e.target.value })} />
            </div>
            <input className="field" value={scene.title} placeholder="Window title" aria-label="Window title"
              onFocus={onFocus} onChange={(e) => set({ title: e.target.value })} />
          </div>
          <textarea className="code" id={`out-${scene.id}`} rows={4} spellCheck={false} value={scene.output} aria-label="Output"
            placeholder="What the command prints, one line per line"
            onFocus={onFocus} onChange={(e) => set({ output: e.target.value })} />
          <label className="check">
            <input type="checkbox" checked={!!scene.typing} onChange={(e) => set({ typing: e.target.checked })} />
            Type the command out, then print the output line by line
          </label>
        </>
      )}

      {/* ---------- automatic voiceover ---------- */}
      {!hasAudio && (
        <div className={'voice-row' + (scene.voice ? ' on' : '')}>
          <label className="switch small" htmlFor={`voice-${scene.id}`}>
            <span className="voice-label"><Mic /> Voiceover</span>
            <input type="checkbox" id={`voice-${scene.id}`} checked={!!scene.voice} onChange={(e) => set({ voice: e.target.checked })} />
          </label>
          {scene.voice && (
            <span className="voice-status">
              {!(scene.say || scene.text || '').trim() ? 'Add text to hear it'
                : voiceStatus === 'working' ? (model && model !== 'loaded' ? `Downloading voice model ${model.pct}%…` : 'Making voice…')
                : voiceStatus === 'error' ? <>Couldn’t make it · <button type="button" className="link-btn" onClick={onRetryVoice}>Try again</button></>
                : scene.voiceDur ? <>Ready · {scene.voiceDur}s{scene.dur - scene.voiceDur > 1.2 && <> · <button type="button" className="link-btn" onClick={onFitAudio}>Fit length</button></>}</>
                : 'Waiting…'}
            </span>
          )}
          {scene.voice && (
            <input className="field say" id={`say-${scene.id}`} value={scene.say || ''} onFocus={onFocus}
              placeholder="Say this instead (optional)"
              onChange={(e) => set({ say: e.target.value })} />
          )}
        </div>
      )}

      <div className="scene-foot">
        <div className="dur">
          <span className="hint">Length</span>
          <button className="step" type="button" aria-label="Shorter" onClick={() => step(-0.5)}>−</button>
          <span className="dur-val">{scene.dur.toFixed(1)}s</span>
          <button className="step" type="button" aria-label="Longer" onClick={() => step(0.5)}>+</button>
        </div>
        <div className="audio-row">
          {hasAudio ? (
            <>
              <span className="audio-chip" title={scene.audioName}>
                <span>♪ {scene.audioName}{scene.audioDur ? ` · ${scene.audioDur}s` : ''}</span>
                <button type="button" aria-label="Remove scene audio" onClick={onClearAudio}>×</button>
              </span>
              {scene.audioDur && Math.abs(scene.audioDur + 0.3 - scene.dur) > 0.5 && (
                <button type="button" className="link-btn" onClick={onFitAudio}>Fit length</button>
              )}
            </>
          ) : (
            <button type="button" className="link-btn" onClick={() => audioRef.current?.click()}>
              {scene.audioName ? `♪ Re-add ${scene.audioName}` : '+ Upload audio'}
            </button>
          )}
          <input ref={audioRef} type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files[0]; if (f) onAudio(f); e.target.value = ''; }} />
        </div>
      </div>
    </div>
  );
}

const ASPECT_NAMES = { '9:16': 'Short 9:16', '4:5': '4:5', '1:1': 'square', '16:9': 'wide 16:9', free: 'custom shape' };

function CropRow({ scene, onCrop, onClearCrop }) {
  return (
    <div className="crop-row">
      <span className="crop-state">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5V12h10.5M1.5 4H12v10.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        {scene.crop ? <>Showing a <b>{ASPECT_NAMES[scene.cropAspect] || 'custom'}</b> area</> : 'Showing the whole picture'}
      </span>
      <span className="crop-btns">
        <button type="button" className="btn small" onClick={onCrop}>{scene.crop ? 'Change area' : 'Crop area'}</button>
        {scene.crop && <button type="button" className="link-btn" onClick={onClearCrop}>Show all</button>}
      </span>
    </div>
  );
}

function FrameRow({ scene, set, onFocus }) {
  return (
    <div className="grid2">
      <div className="mini-field">
        <span className="mini-label">Frame</span>
        <Seg items={FRAMES} value={scene.frame || 'none'} onPick={(f) => {
          const layout = { ...(scene.layout || {}) };
          delete layout.media; // a new frame changes the shape, so re-fit
          set({ frame: f, layout });
        }} />
      </div>
      {scene.frame === 'browser' ? (
        <div className="mini-field">
          <span className="mini-label">Address bar</span>
          <input className="field" value={scene.url || ''} placeholder="yourwebsite.com" onFocus={onFocus}
            onChange={(e) => set({ url: e.target.value })} aria-label="Website address shown in the frame" />
        </div>
      ) : <div />}
    </div>
  );
}
