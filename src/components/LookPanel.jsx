import React, { useRef, useState } from 'react';
import { LOOKS, FONTS, ANIMS, POSITIONS, TEXT_STYLES } from '../presets.js';
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

const TABS = [['style', 'Style'], ['audio', 'Audio'], ['brand', 'Brand']];
const SWATCHES = ['#4f46e5', '#e11d48', '#f97316', '#ffb020', '#16a34a', '#0891b2', '#7c3aed', '#111827'];

export default function LookPanel(props) {
  const { project, update, onReplay, files, onBg, onClearBg, onSound, onClearSound, model, onPreviewVoice, onVoiceAll, onLogo, onClearLogo, logoUrl } = props;
  const [tab, setTab] = useState(() => { try { return localStorage.getItem('shortsmith-tab') || 'style'; } catch { return 'style'; } });
  const pick = (t) => { setTab(t); try { localStorage.setItem('shortsmith-tab', t); } catch { /* ignore */ } };
  const fileRef = useRef(null);
  const musicRef = useRef(null);
  const logoRef = useRef(null);
  const look = LOOKS.find((l) => l.id === project.look) || LOOKS[0];

  return (
    <aside className="panel side" aria-label="Settings">
      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => pick(id)}>{label}</button>
        ))}
      </div>

      {tab === 'style' && (
        <>
          <div className="group">
            <div className="label">Background <span className="lookname">{look.name}</span></div>
            <div className="looks">
              {LOOKS.map((L) => (
                <button key={L.id} type="button" className="look" style={{ background: L.swatch }} aria-label={L.name} title={L.name}
                  aria-pressed={project.look === L.id} onClick={() => update({ look: L.id })}>
                  <em style={{ color: L.paper || L.light ? '#151515' : '#fff' }}>{L.name}</em>
                </button>
              ))}
            </div>
            <div className="upload">
              <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>{files.bg ? 'Replace photo…' : 'Use a photo instead…'}</button>
              {files.bg && <button type="button" className="btn small" onClick={onClearBg}>Remove</button>}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; if (f) onBg(f); e.target.value = ''; }} />
            </div>
            {files.bg && <span className="hint">{files.bg}</span>}
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
            <div className="label">Text style</div>
            <Seg items={TEXT_STYLES} value={project.textStyle || 'plain'} onPick={(id) => update({ textStyle: id })} />
            <div className="label" style={{ marginTop: 4 }}>Text motion</div>
            <Seg items={ANIMS} value={project.anim} onPick={(id) => { update({ anim: id }); onReplay(); }} />
          </div>

          <div className="group">
            <div className="label">Text size <output>{project.size}%</output></div>
            <input type="range" id="size" min="70" max="140" step="5" value={project.size} onChange={(e) => update({ size: +e.target.value })} />
            <div className="label" style={{ marginTop: 4 }}>Default position <span className="hint" style={{ textTransform: 'none', letterSpacing: 0 }}>or drag it on the preview</span></div>
            <Seg items={POSITIONS} value={project.pos} onPick={(id) => update({ pos: id })} />
          </div>

          <div className="group">
            <label className="switch" htmlFor="progress">
              <span>Story progress bar</span>
              <input type="checkbox" id="progress" checked={project.progress !== false} onChange={(e) => update({ progress: e.target.checked })} />
            </label>
            <label className="switch" htmlFor="safeToggle">
              <span>Show safe zones</span>
              <input type="checkbox" id="safeToggle" checked={project.safe} onChange={(e) => update({ safe: e.target.checked })} />
            </label>
            <span className="hint">Shows where Shorts, Reels and TikTok put their buttons and caption. Not exported.</span>
          </div>
        </>
      )}

      {tab === 'audio' && (
        <>
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
            {project.music !== 'none' && project.music !== 'file' && <span className="hint">Made in the app, so it’s free to use anywhere.</span>}
            {project.music !== 'none' && (
              <>
                <div className="label" style={{ marginTop: 4 }}>Music volume <output>{project.musicVol}%</output></div>
                <input type="range" id="musicVol" min="0" max="100" step="5" value={project.musicVol} onChange={(e) => update({ musicVol: +e.target.value })} />
              </>
            )}
          </div>

          <div className="group">
            <div className="label">Voiceover</div>
            <span className="hint">Switch on <b>Voiceover</b> in a scene to have its text read aloud. Made on your computer, free.</span>
            <div className="voice-pick">
              <select className="field" id="ttsVoice" value={project.ttsVoice} onChange={(e) => update({ ttsVoice: e.target.value })} aria-label="Voice">
                {VOICES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
              <button type="button" className="btn small" onClick={onPreviewVoice}>▶ Try</button>
            </div>
            <div className="label" style={{ marginTop: 4 }}>Speaking speed <output>{Number(project.ttsSpeed).toFixed(2)}×</output></div>
            <input type="range" id="ttsSpeed" min="0.8" max="1.3" step="0.05" value={project.ttsSpeed} onChange={(e) => update({ ttsSpeed: +e.target.value })} />
            <label className="switch" htmlFor="ttsAuto">
              <span>On for new text scenes</span>
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
              <span>Lower music under voices & video sound</span>
              <input type="checkbox" id="duck" checked={project.duck} onChange={(e) => update({ duck: e.target.checked })} />
            </label>
          </div>

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
            {(project.sfxTyping || project.sfxWhoosh) && (
              <>
                <div className="label" style={{ marginTop: 4 }}>Effects volume <output>{project.sfxVol}%</output></div>
                <input type="range" id="sfxVol" min="0" max="100" step="5" value={project.sfxVol} onChange={(e) => update({ sfxVol: +e.target.value })} />
              </>
            )}
          </div>
        </>
      )}

      {tab === 'brand' && (
        <>
          <div className="group">
            <div className="label">Logo</div>
            <div className="logo-row">
              <div className="logo-prev" style={logoUrl ? { backgroundImage: `url(${logoUrl})` } : undefined}>
                {!logoUrl && <span>{(project.handle || '?').replace('@', '')[0]?.toUpperCase() || '?'}</span>}
              </div>
              <div className="upload">
                <button type="button" className="btn small" onClick={() => logoRef.current?.click()}>{logoUrl ? 'Replace…' : 'Upload logo…'}</button>
                {logoUrl && <button type="button" className="btn small" onClick={onClearLogo}>Remove</button>}
              </div>
              <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; if (f) onLogo(f); e.target.value = ''; }} />
            </div>
            <span className="hint">Shown in a circle at the top left, next to your handle. Square images work best.</span>
          </div>

          <div className="group">
            <div className="label">Handle or brand name</div>
            <input className="field" id="handle" type="text" maxLength={32} value={project.handle} placeholder="@yourbrand (leave empty to hide)"
              onChange={(e) => update({ handle: e.target.value })} />
          </div>

          <div className="group">
            <div className="label">Brand colour</div>
            <div className="swatches">
              {SWATCHES.map((c) => (
                <button key={c} type="button" className="sw" style={{ background: c }} aria-label={c} aria-pressed={project.brandColor === c}
                  onClick={() => update({ brandColor: c, useBrand: true })} />
              ))}
              <label className="sw custom" title="Pick any colour">
                <input type="color" value={project.brandColor || '#4f46e5'} onChange={(e) => update({ brandColor: e.target.value, useBrand: true })} aria-label="Custom brand colour" />
              </label>
            </div>
            <label className="switch" htmlFor="useBrand">
              <span>Use it for highlighted words</span>
              <input type="checkbox" id="useBrand" checked={!!project.useBrand} onChange={(e) => update({ useBrand: e.target.checked })} />
            </label>
            <span className="hint">Highlighted words are the ones you wrap in <code>*stars*</code>.</span>
          </div>
        </>
      )}
    </aside>
  );
}
