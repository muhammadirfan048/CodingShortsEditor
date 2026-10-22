import React, { useRef } from 'react';
import { LANGS, SCENE_TYPES } from '../presets.js';

const Up = () => <svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 3l5 6H3z" fill="currentColor" /></svg>;
const Down = () => <svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 13L3 7h10z" fill="currentColor" /></svg>;
const Del = () => <svg width="14" height="14" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;

export default function SceneCard({ scene, index, count, active, hasImage, onChange, onType, onMove, onDelete, onFocus, onImage, hasAudio, onAudio, onClearAudio, onFitAudio, voiceStatus, model, onRetryVoice }) {
  const fileRef = useRef(null);
  const audioRef = useRef(null);
  const set = (patch) => onChange({ ...scene, ...patch });
  const step = (d) => set({ dur: Math.min(60, Math.max(1, Math.round((scene.dur + d) * 2) / 2)) });

  return (
    <div className={'scene' + (active ? ' active' : '')} onClick={(e) => { if (e.target === e.currentTarget) onFocus(); }}>
      <div className="scene-top">
        <span className="num">Scene {String(index + 1).padStart(2, '0')}</span>
        <div className="mini-seg" role="group" aria-label="Scene type">
          {SCENE_TYPES.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={scene.type === id} onClick={() => onType(id)}>{label}</button>
          ))}
        </div>
        <span className="spacer" />
        <button className="icon-btn" type="button" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)}><Up /></button>
        <button className="icon-btn" type="button" aria-label="Move down" disabled={index === count - 1} onClick={() => onMove(1)}><Down /></button>
        <button className="icon-btn" type="button" aria-label="Delete scene" disabled={count < 2} onClick={onDelete}><Del /></button>
      </div>

      {scene.type === 'text' && (
        <textarea id={`text-${scene.id}`} rows={2} value={scene.text} aria-label="Scene text"
          onFocus={onFocus} onChange={(e) => set({ text: e.target.value })} />
      )}

      {scene.type === 'code' && (
        <>
          <input className="field" id={`cap-${scene.id}`} value={scene.text} placeholder="Caption above the code (optional)"
            onFocus={onFocus} onChange={(e) => set({ text: e.target.value })} />
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

      {scene.type === 'terminal' && (
        <>
          <input className="field" value={scene.text} placeholder="Caption above the terminal (optional)"
            onFocus={onFocus} onChange={(e) => set({ text: e.target.value })} />
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

      {scene.type === 'image' && (
        <>
          <input className="field" value={scene.text} placeholder="Caption above the screenshot (optional)"
            onFocus={onFocus} onChange={(e) => set({ text: e.target.value })} />
          <div className="upload">
            <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>
              {hasImage ? 'Replace screenshot…' : 'Choose screenshot…'}
            </button>
            <span className="hint">{hasImage ? scene.imageName : scene.imageName ? `Re-add “${scene.imageName}”` : 'PNG or JPG, e.g. a VS Code screenshot'}</span>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; if (f) onImage(f); e.target.value = ''; }} />
          </div>
        </>
      )}

      {/* ---------- automatic voiceover ---------- */}
      {!hasAudio && (
        <div className={'voice-row' + (scene.voice ? ' on' : '')}>
          <label className="switch small" htmlFor={`voice-${scene.id}`}>
            <span className="voice-label">
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="1.5" width="5" height="8.5" rx="2.5" fill="currentColor" /><path d="M3 7.5a5 5 0 0 0 10 0M8 12.5V15" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
              Voiceover
            </span>
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
              placeholder="Say this instead (optional), e.g. “the or operator”"
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
                <button type="button" className="link-btn" onClick={onFitAudio}>Fit length to audio</button>
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
