import React, { useRef } from 'react';
import { LOOKS, FONTS, ANIMS, POSITIONS } from '../presets.js';
import { MUSIC_TRACKS } from '../audio.js';
import { VOICES } from '../tts.js';

function Seg({ items, value, onPick, className = '' }) {
  return (
    <div className={'seg-ctl ' + className}>
      {items.map(([id, label]) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onPick(id)}>{label}</button>
      ))}
    </div>
  );
}

/** One upload slot: shows the built-in or uploaded sound, with Upload / Remove. */
function SoundSlot({ kind, label, name, builtIn, onSound, onClear, hint }) {
  const ref = useRef(null);
  return (
    <div className="sound-src">
      <span style={{ minWidth: 0, display: 'flex', gap: 6, overflow: 'hidden' }}>
        {label}: <b title={name || builtIn}>{name || builtIn}</b>
      </span>
      <span style={{ display: 'flex', gap: 4, flex: 'none' }}>
        <button type="button" className="link-btn" onClick={() => ref.current?.click()}>{name ? 'Replace' : 'Upload'}</button>
        {name && <button type="button" className="link-btn" onClick={() => onClear(kind)}>{builtIn ? 'Use built-in' : 'Remove'}</button>}
      </span>
      <input ref={ref} type="file" accept="audio/*" hidden aria-label={hint}
        onChange={(e) => { const f = e.target.files[0]; if (f) onSound(kind, f); e.target.value = ''; }} />
    </div>
  );
}

export default function LookPanel({ project, update, onReplay, files, onBg, onClearBg, onSound, onClearSound, model, onPreviewVoice, onVoiceAll }) {
  const fileRef = useRef(null);
  const musicRef = useRef(null);
  const look = LOOKS.find((l) => l.id === project.look) || LOOKS[0];
  return (
    <aside className="panel" aria-labelledby="lookH">
      <div className="panel-head"><h2 id="lookH">Look & sound</h2><span className="lookname">{look.name}</span></div>

      <div className="group">
        <div className="label">Background</div>
        <div className="looks">
          {LOOKS.map((L) => (
            <button key={L.id} type="button" className="look" style={{ background: L.swatch }} aria-label={L.name}
              aria-pressed={project.look === L.id} onClick={() => update({ look: L.id })}>
              <em style={{ color: L.paper ? '#151515' : '#fff' }}>{L.name}</em>
            </button>
          ))}
        </div>
      </div>

      <div className="group">
        <div className="label">Typeface</div>
        <div className="fonts">
          {FONTS.map((F) => (
            <button key={F.id} type="button" className="font" aria-pressed={project.font === F.id} onClick={() => update({ font: F.id })}>
              <b style={{ fontFamily: `'${F.family}', serif`, fontWeight: F.weight }}>Aa</b>
              <span>{F.label}<br />{F.note}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="group">
        <div className="label">Text motion</div>
        <Seg items={ANIMS} value={project.anim} onPick={(id) => { update({ anim: id }); onReplay(); }} />
      </div>

      <div className="group">
        <div className="label">Text size <output>{project.size}%</output></div>
        <input type="range" id="size" min="70" max="140" step="5" value={project.size} onChange={(e) => update({ size: +e.target.value })} />
        <div className="label" style={{ marginTop: 4 }}>Position <span className="hint" style={{ textTransform: 'none', letterSpacing: 0 }}>text scenes</span></div>
        <Seg items={POSITIONS} value={project.pos} onPick={(id) => update({ pos: id })} />
      </div>

      {/* ---------- Music ---------- */}
      <div className="group">
        <div className="label">Music</div>
        <Seg className="music" items={MUSIC_TRACKS} value={project.music}
          onPick={(id) => { if (id === 'file' && !files.music) musicRef.current?.click(); else update({ music: id }); }} />
        <input ref={musicRef} type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files[0]; if (f) onSound('music', f); e.target.value = ''; }} />
        {project.music === 'file' && (
          <div className="sound-row">
            <SoundSlot kind="music" label="Your music" name={files.music} builtIn="" onSound={onSound} onClear={onClearSound} hint="Upload music" />
          </div>
        )}
        {project.music !== 'none' && project.music !== 'file' && <span className="hint">Made in the app, so it’s free to use on YouTube.</span>}
        {project.music !== 'none' && (
          <>
            <div className="label" style={{ marginTop: 4 }}>Music volume <output>{project.musicVol}%</output></div>
            <input type="range" id="musicVol" min="0" max="100" step="5" value={project.musicVol} onChange={(e) => update({ musicVol: +e.target.value })} />
          </>
        )}
      </div>

      {/* ---------- Sound effects ---------- */}
      <div className="group">
        <div className="label">Sound effects</div>
        <div className="sound-row">
          <label className="switch" htmlFor="sfxTyping">
            <span>Typing (code & terminal)</span>
            <input type="checkbox" id="sfxTyping" checked={project.sfxTyping} onChange={(e) => update({ sfxTyping: e.target.checked })} />
          </label>
          <SoundSlot kind="typing" label="Sound" name={files.typing} builtIn="Built-in clicks" onSound={onSound} onClear={onClearSound} hint="Upload a typing sound" />
        </div>
        <div className="sound-row">
          <label className="switch" htmlFor="sfxWhoosh">
            <span>Scene transition</span>
            <input type="checkbox" id="sfxWhoosh" checked={project.sfxWhoosh} onChange={(e) => update({ sfxWhoosh: e.target.checked })} />
          </label>
          <SoundSlot kind="whoosh" label="Sound" name={files.whoosh} builtIn="Built-in whoosh" onSound={onSound} onClear={onClearSound} hint="Upload a transition sound" />
        </div>
        <span className="hint">Typing: upload one key click (it plays on every letter) or a longer typing recording (it loops while typing).</span>
        {(project.sfxTyping || project.sfxWhoosh) && (
          <>
            <div className="label" style={{ marginTop: 4 }}>Effects volume <output>{project.sfxVol}%</output></div>
            <input type="range" id="sfxVol" min="0" max="100" step="5" value={project.sfxVol} onChange={(e) => update({ sfxVol: +e.target.value })} />
          </>
        )}
      </div>

      {/* ---------- Voiceover ---------- */}
      <div className="group">
        <div className="label">Voiceover</div>
        <span className="hint">Each scene can read its text aloud. Switch <b>Voiceover</b> on in a scene card. It’s made on your computer and recorded into the video.</span>
        <div className="voice-pick">
          <select className="field" id="ttsVoice" value={project.ttsVoice} onChange={(e) => update({ ttsVoice: e.target.value })} aria-label="Voice">
            {VOICES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <button type="button" className="btn small" onClick={onPreviewVoice}>▶ Try</button>
        </div>
        <div className="label" style={{ marginTop: 4 }}>Speaking speed <output>{Number(project.ttsSpeed).toFixed(2)}×</output></div>
        <input type="range" id="ttsSpeed" min="0.8" max="1.3" step="0.05" value={project.ttsSpeed} onChange={(e) => update({ ttsSpeed: +e.target.value })} />
        <label className="switch" htmlFor="ttsAuto">
          <span>Turn on for new text scenes</span>
          <input type="checkbox" id="ttsAuto" checked={!!project.ttsAuto} onChange={(e) => update({ ttsAuto: e.target.checked })} />
        </label>
        <div className="upload">
          <button type="button" className="btn small" onClick={() => onVoiceAll(true)}>All text scenes on</button>
          <button type="button" className="btn small" onClick={() => onVoiceAll(false)}>All off</button>
        </div>
        {model && model !== 'loaded' && (
          <div style={{ display: 'grid', gap: 4 }}>
            <span className="hint">Downloading the voice model, first time only{model.mb ? ` (${model.mb} MB)` : ''}: {model.pct}%</span>
            <div className="model-bar"><i style={{ width: model.pct + '%' }} /></div>
          </div>
        )}
        <div className="label" style={{ marginTop: 4 }}>Voice & scene audio volume <output>{project.sceneVol}%</output></div>
        <input type="range" id="sceneVol" min="0" max="150" step="5" value={project.sceneVol} onChange={(e) => update({ sceneVol: +e.target.value })} />
        <label className="switch" htmlFor="duck">
          <span>Lower the music while voices play</span>
          <input type="checkbox" id="duck" checked={project.duck} onChange={(e) => update({ duck: e.target.checked })} />
        </label>
        <span className="hint">You can still upload your own recording on any scene with <b>+ Upload audio</b>. It replaces the automatic voice.</span>
      </div>

      <div className="group">
        <div className="label">Channel handle</div>
        <input className="field" id="handle" type="text" maxLength={28} value={project.handle} onChange={(e) => update({ handle: e.target.value })} />
      </div>

      <div className="group">
        <div className="label">Background photo</div>
        <div className="upload">
          <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>{files.bg ? 'Replace…' : 'Choose image…'}</button>
          {files.bg && <button type="button" className="btn small" onClick={onClearBg}>Remove</button>}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; if (f) onBg(f); e.target.value = ''; }} />
        </div>
        {files.bg && <span className="hint">{files.bg}</span>}
      </div>

      <div className="group">
        <label className="switch" htmlFor="safeToggle">
          <span>Show Shorts safe zones</span>
          <input type="checkbox" id="safeToggle" checked={project.safe} onChange={(e) => update({ safe: e.target.checked })} />
        </label>
        <span className="hint">Shows where YouTube’s buttons and caption sit. Not recorded.</span>
      </div>
    </aside>
  );
}
