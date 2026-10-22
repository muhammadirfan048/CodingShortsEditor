// Canvas renderer: draws one frame of the Short at a given time.
// Everything is drawn at 1080x1920; the preview just scales the canvas with CSS.

import { LOOKS, FONTS, LANGS } from './presets.js';
import { highlight, EDITOR_THEME as ED } from './highlight.js';

export const W = 1080;
export const H = 1920;

/* ---------- helpers ---------- */
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeOut = (p) => 1 - Math.pow(1 - p, 3);
const easeBack = (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export const fmtTime = (s) => {
  s = Math.max(0, s);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1);
};

export const totalDuration = (p) => p.scenes.reduce((a, s) => a + s.dur, 0);

export function sceneAt(p, time) {
  let acc = 0;
  for (let i = 0; i < p.scenes.length; i++) {
    const d = p.scenes[i].dur;
    if (time < acc + d || i === p.scenes.length - 1) return { i, lt: Math.min(Math.max(0, time - acc), d), start: acc };
    acc += d;
  }
  return { i: 0, lt: 0, start: 0 };
}

function lookOf(p) {
  const L = LOOKS.find((l) => l.id === p.look) || LOOKS[0];
  if (p.brandColor && p.useBrand) return { ...L, hi: L.marker ? '#151515' : p.brandColor, markerColor: p.brandColor, brand: p.brandColor };
  return L;
}
const fontOf = (p) => FONTS.find((f) => f.id === p.font) || FONTS[1];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/* ---------- *highlight* parsing ---------- */
export function parseHighlights(text) {
  const out = [];
  let hi = false;
  text.trim().split(/\s+/).forEach((raw) => {
    if (!raw) return;
    const s = raw.startsWith('*');
    const e = /\*[^\w*]*$/.test(raw) && raw.length > 1;
    const w = raw.replace(/\*/g, '');
    if (!w) return;
    out.push({ t: w, hi: hi || s });
    hi = e ? false : s ? true : hi;
  });
  return out;
}

/* ---------- grain ---------- */
let grainPat = null;
function getGrain(ctx) {
  if (grainPat) return grainPat;
  const g = document.createElement('canvas');
  g.width = g.height = 256;
  const gx = g.getContext('2d');
  const d = gx.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.random() * 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  gx.putImageData(d, 0, 0);
  grainPat = ctx.createPattern(g, 'repeat');
  return grainPat;
}

/* ---------- backgrounds ---------- */
function drawBlobs(ctx, time, cols, r = 950, a = 0.75) {
  cols.forEach((c, i) => {
    const x = W * (0.5 + 0.38 * Math.sin(time * 0.33 + i * 2.1));
    const y = H * (0.5 + 0.34 * Math.cos(time * 0.27 + i * 1.7));
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(c, a));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  });
}

function drawBg(ctx, p, time, bgImg) {
  const L = lookOf(p);
  if (bgImg) {
    const sc = Math.max(W / bgImg.width, H / bgImg.height) * (1.06 + 0.04 * Math.sin(time * 0.25));
    const w = bgImg.width * sc, h = bgImg.height * sc;
    ctx.drawImage(bgImg, (W - w) / 2, (H - h) / 2, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,.35)');
    g.addColorStop(0.5, 'rgba(0,0,0,.5)');
    g.addColorStop(1, 'rgba(0,0,0,.6)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (L.neon) {
    ctx.fillStyle = '#0b0718';
    ctx.fillRect(0, 0, W, H);
    drawBlobs(ctx, time, [[255, 47, 180], [94, 242, 255]], 800, 0.35);
    const hz = H * 0.64;
    const sg = ctx.createLinearGradient(0, hz - 520, 0, hz);
    sg.addColorStop(0, '#ffcf5c');
    sg.addColorStop(1, '#ff2fb4');
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, hz, 380, Math.PI, 0);
    ctx.fillStyle = sg;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0b0718';
    for (let k = 0; k < 7; k++) ctx.fillRect(0, hz - 30 - k * 48, W, 6 + k * 0.6);
    ctx.restore();
    const fg = ctx.createLinearGradient(0, hz, 0, H);
    fg.addColorStop(0, '#2a0b3a');
    fg.addColorStop(1, '#0b0718');
    ctx.fillStyle = fg;
    ctx.fillRect(0, hz, W, H - hz);
    ctx.strokeStyle = 'rgba(255,47,180,.75)';
    ctx.lineWidth = 3;
    for (let k = -12; k <= 12; k++) { ctx.beginPath(); ctx.moveTo(W / 2 + k * 30, hz); ctx.lineTo(W / 2 + k * 260, H); ctx.stroke(); }
    for (let k = 0; k < 14; k++) {
      const z = ((k + time * 0.9) % 14) / 14;
      const y = hz + (H - hz) * z * z;
      ctx.globalAlpha = z;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (L.paper) {
    ctx.fillStyle = '#f2eee4';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(110,150,200,.28)';
    ctx.lineWidth = 2;
    for (let y = 260; y < H; y += 78) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(220,70,70,.35)';
    ctx.beginPath(); ctx.moveTo(130, 0); ctx.lineTo(130, H); ctx.stroke();
  } else {
    const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
    g.addColorStop(0, L.base[0]);
    g.addColorStop(1, L.base[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    drawBlobs(ctx, time, L.blobs);
  }
  ctx.save();
  ctx.globalAlpha = L.paper && !bgImg ? 0.05 : 0.07;
  ctx.globalCompositeOperation = 'overlay';
  ctx.translate(((time * 977) % 256) | 0, ((time * 613) % 256) | 0);
  ctx.fillStyle = getGrain(ctx);
  ctx.fillRect(-256, -256, W + 512, H + 512);
  ctx.restore();
}

/* ---------- text layout ---------- */
const layoutCache = new Map();
let mctx = null;
const measureCtx = () => (mctx || (mctx = document.createElement('canvas').getContext('2d')));
export const clearLayoutCache = () => layoutCache.clear();

function layoutText(ctx, p, text, sizeMul = 1, maxW = 880) {
  const F = fontOf(p);
  const size = Math.round(108 * F.scale * (p.size / 100) * sizeMul);
  const key = [text, F.id, size, maxW].join('|');
  if (layoutCache.has(key)) return layoutCache.get(key);
  const fontStr = `${F.weight} ${size}px "${F.family}"`;
  ctx.font = fontStr;
  const toks = parseHighlights(text).map((o) => ({ ...o, t: F.upper ? o.t.toUpperCase() : o.t }));
  const space = ctx.measureText(' ').width;
  const lines = [];
  let cur = [], w = 0;
  toks.forEach((tk) => {
    tk.w = ctx.measureText(tk.t).width;
    if (cur.length && w + space + tk.w > maxW) { lines.push({ toks: cur, w }); cur = []; w = 0; }
    w += (cur.length ? space : 0) + tk.w;
    cur.push(tk);
  });
  if (cur.length) lines.push({ toks: cur, w });
  let wi = 0, ci = 0;
  lines.forEach((l) => {
    let x = (W - l.w) / 2;
    l.toks.forEach((tk) => { tk.x = x; tk.wi = wi++; tk.ci = ci; ci += tk.t.length + 1; x += tk.w + space; });
  });
  const res = { lines, size, fontStr, lh: size * 1.18, words: wi, chars: ci };
  if (layoutCache.size > 300) layoutCache.clear();
  layoutCache.set(key, res);
  return res;
}

function drawToken(ctx, tk, y, L, text, size, onImage) {
  if (tk.hi && L.marker) {
    ctx.save();
    ctx.fillStyle = L.markerColor || 'rgba(255,214,0,.9)';
    const fw = ctx.measureText(text).width;
    ctx.beginPath();
    ctx.moveTo(tk.x - 12, y - size * 0.72);
    ctx.lineTo(tk.x + fw + 14, y - size * 0.78);
    ctx.lineTo(tk.x + fw + 10, y + size * 0.16);
    ctx.lineTo(tk.x - 14, y + size * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#151515';
  } else if (L.boxed) {
    ctx.fillStyle = tk.hi ? (L.brand || '#e11d48') : '#111111';
  } else {
    ctx.fillStyle = tk.hi ? L.hi : onImage ? '#ffffff' : L.fg;
  }
  ctx.fillText(text, tk.x, y);
}

/**
 * Draws animated text. cy = vertical centre of the block.
 * opts.anim overrides motion, opts.sizeMul scales text, opts.dur is the scene length.
 */
function drawTextBlock(ctx, p, text, lt, dur, cy, { sizeMul = 1, exit = true, onImage = false, anim, cx = W / 2, maxW = 880 } = {}) {
  if (!text || !text.trim()) return 0;
  let L = lookOf(p);
  const boxed = p.textStyle === 'box';
  if (boxed) L = { ...L, boxed: true, marker: false };
  const lay = layoutText(ctx, p, text, sizeMul, maxW);
  ctx.font = lay.fontStr;
  ctx.textBaseline = 'alphabetic';
  const blockH = lay.lines.length * lay.lh;
  const y0 = cy - blockH / 2 + lay.size * 0.86;
  let exitA = 1, exitY = 0;
  if (exit && lt > dur - 0.28) { const q = clamp((dur - lt) / 0.28); exitA = q; exitY = (1 - q) * -40; }
  ctx.save();
  ctx.translate(cx - W / 2, 0);
  if (boxed) {
    // a rounded label behind each line, like social captions
    const q = easeOut(clamp(lt / 0.3));
    ctx.save();
    ctx.globalAlpha = q * exitA;
    ctx.fillStyle = '#ffffff';
    lay.lines.forEach((ln, li) => {
      const y = y0 + li * lay.lh + exitY;
      const lx = (W - ln.w) / 2;
      const padX = lay.size * 0.28, padT = lay.size * 0.86, padB = lay.size * 0.3;
      roundRect(ctx, lx - padX, y - padT, ln.w + padX * 2, padT + padB, lay.size * 0.18);
      ctx.fill();
    });
    ctx.restore();
  } else if (L.shadow || onImage) { ctx.shadowColor = 'rgba(0,0,0,.38)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 6; }
  const A = anim || p.anim;
  if (A === 'pop') {
    const q = clamp(lt / 0.42);
    const s = 0.82 + 0.18 * easeBack(q);
    ctx.globalAlpha = clamp(lt / 0.18) * exitA;
    ctx.translate(W / 2, cy + exitY); ctx.scale(s, s); ctx.translate(-W / 2, -cy);
  } else ctx.translate(0, exitY);

  const step = Math.min(0.2, (dur * 0.55) / Math.max(1, lay.words));
  const shownChars = Math.floor(lt * 32);
  lay.lines.forEach((ln, li) => {
    const y = y0 + li * lay.lh;
    ln.toks.forEach((tk) => {
      if (A === 'pop') return drawToken(ctx, tk, y, L, tk.t, lay.size, onImage);
      if (A === 'rise') {
        const q = easeOut(clamp((lt - li * 0.1) / 0.5));
        ctx.save(); ctx.globalAlpha = q * exitA; ctx.translate(0, (1 - q) * 80);
        drawToken(ctx, tk, y, L, tk.t, lay.size, onImage); ctx.restore();
        return;
      }
      if (A === 'words') {
        const q = clamp((lt - tk.wi * step) / 0.24);
        if (q <= 0) return;
        const s = 0.55 + 0.45 * easeBack(q);
        const cx = tk.x + tk.w / 2, cyw = y - lay.size * 0.35;
        ctx.save(); ctx.globalAlpha = clamp(q * 2) * exitA;
        ctx.translate(cx, cyw); ctx.scale(s, s); ctx.translate(-cx, -cyw);
        drawToken(ctx, tk, y, L, tk.t, lay.size, onImage); ctx.restore();
        return;
      }
      if (A === 'type') {
        const n = shownChars - tk.ci;
        if (n <= 0) return;
        ctx.save(); ctx.globalAlpha = exitA;
        drawToken(ctx, tk, y, L, tk.t.slice(0, n), lay.size, onImage); ctx.restore();
      }
    });
  });
  ctx.restore();
  return blockH;
}

/* ======================================================================
   LAYOUT
   Every scene is made of up to two movable parts:
     text / caption  -> { cx, cy, w, s }   (centre, wrap width, size)
     media           -> { x, y, w, h }     (image, video, code or terminal box)
   sc.layout holds what the user dragged; anything missing uses a default.
   ====================================================================== */
const posY = (p) => (p.pos === 'top' ? 640 : p.pos === 'low' ? 1240 : H / 2 - 40);
export const MEDIA_TYPES = ['image', 'video', 'code', 'terminal'];

function textBox(p, text, user, def) {
  const t = { ...def, ...(user || {}) };
  const lay = layoutText(measureCtx(), p, (text || ' ').trim() || ' ', t.s, t.w);
  const h = Math.max(lay.lh, lay.lines.length * lay.lh);
  return { kind: 'text', cx: t.cx, cy: t.cy, w: t.w, s: t.s, x: t.cx - t.w / 2, y: t.cy - h / 2, h, user: !!user };
}

/* ---------- code metrics ---------- */
const CODE_BAR = 78;
function codeMetrics(sc, user, top) {
  const rawLines = (sc.code || '').replace(/\t/g, '  ').split('\n');
  const maxLen = Math.max(12, ...rawLines.map((l) => l.length));
  const digits = String(rawLines.length).length;
  let fs, lh, maxVisible, box;
  if (user) {
    fs = clamp(Math.floor((user.w - 122) / (0.61 * (maxLen + digits))), 14, 48);
    lh = Math.round(fs * 1.6);
    maxVisible = Math.max(1, Math.floor((user.h - CODE_BAR - 68) / lh));
    box = { x: user.x, y: user.y, w: user.w, h: user.h };
  } else {
    fs = clamp(Math.floor(860 / (maxLen * 0.61)), 22, 36);
    lh = Math.round(fs * 1.6);
    maxVisible = Math.floor(1060 / lh);
    const h = CODE_BAR + 68 + Math.min(rawLines.length, maxVisible) * lh;
    const y = Math.max(top, Math.min(1500 - h, H / 2 - h / 2 + (top === 560 ? 90 : 0)));
    box = { x: 40, y, w: W - 80, h };
  }
  return { box, fs, lh, maxVisible, rawLines };
}

/* ---------- terminal metrics ---------- */
const TERM_BAR = 70;
const PROMPT = '➜ ~/shorts ';
function terminalMetrics(sc, user, top) {
  const { lines } = terminalTiming(sc);
  const hasOut = (sc.output || '').length > 0;
  const allRows = [PROMPT + '$ ' + (sc.command || ''), ...(hasOut ? lines : []), PROMPT + '$ '];
  const maxLen = Math.max(14, ...allRows.map((l) => l.length));
  let fs, lh, maxVisible, box;
  if (user) {
    fs = clamp(Math.floor((user.w - 72) / (0.61 * maxLen)), 14, 48);
    lh = Math.round(fs * 1.55);
    maxVisible = Math.max(1, Math.floor((user.h - TERM_BAR - 60) / lh));
    box = { x: user.x, y: user.y, w: user.w, h: user.h };
  } else {
    fs = clamp(Math.floor(880 / (maxLen * 0.61)), 22, 38);
    lh = Math.round(fs * 1.55);
    maxVisible = Math.floor(1000 / lh);
    const h = TERM_BAR + 60 + Math.min(allRows.length, maxVisible) * lh;
    const y = Math.max(top, Math.min(1500 - h, H / 2 - h / 2 + (top === 560 ? 90 : 0)));
    box = { x: 40, y, w: W - 80, h };
  }
  return { box, fs, lh, maxVisible, lines, hasOut };
}

/* ---------- image / video metrics ---------- */
/** The size of the picture shown: the cropped area if there is one. */
export function naturalSize(sc, assets = {}) {
  const [w, h] = fullSize(sc, assets);
  const c = sc.crop;
  return c ? [w * c.w, h * c.h] : [w, h];
}

/** The size of the whole uploaded or recorded picture. */
export function fullSize(sc, assets = {}) {
  if (sc.type === 'video') {
    const v = assets.videos && assets.videos.get(sc.id);
    if (v && v.videoWidth) return [v.videoWidth, v.videoHeight];
  } else {
    const img = assets.images && assets.images.get(sc.id);
    if (img && img.width) return [img.width, img.height];
  }
  if (sc.nat) return sc.nat;
  return sc.frame === 'phone' ? [1170, 2532] : [1600, 1000];
}
const browserBar = (w) => Math.round(clamp(w * 0.075, 40, 84));
const phonePad = (w) => Math.round(w * 0.04);

/** The part of a media box the picture fills (inside any device frame). */
export function contentRect(box, frame) {
  if (frame === 'browser') { const b = browserBar(box.w); return { x: box.x, y: box.y + b, w: box.w, h: box.h - b }; }
  if (frame === 'phone') { const pd = phonePad(box.w); return { x: box.x + pd, y: box.y + pd, w: box.w - pd * 2, h: box.h - pd * 2 }; }
  return { ...box };
}

/** The box size that shows the whole picture at width w. */
export function fittedHeight(frame, w, sw, sh) {
  if (frame === 'browser') return browserBar(w) + (w * sh) / sw;
  if (frame === 'phone') { const pd = phonePad(w); return pd * 2 + ((w - pd * 2) * sh) / sw; }
  return (w * sh) / sw;
}

function defaultMediaBox(sc, top, sw, sh) {
  const frame = sc.frame || 'none';
  const RW = frame === 'phone' ? 640 : W - 80;
  const RH = 1500 - top;
  let w = RW;
  let h = fittedHeight(frame, w, sw, sh);
  if (h > RH) { w = w * (RH / h); h = fittedHeight(frame, w, sw, sh); }
  return { x: (W - w) / 2, y: top + (RH - h) / 2, w, h };
}

/** Where everything in a scene sits at rest. Used by the renderer and the drag editor. */
export function sceneLayout(p, sc, assets = {}) {
  const live = assets.live && assets.live.id === sc.id ? assets.live : null;
  const get = (key) => (live && live.key === key ? live.box : sc.layout && sc.layout[key]) || null;
  const out = {};
  if (sc.type === 'text' || !MEDIA_TYPES.includes(sc.type)) {
    out.text = textBox(p, sc.text, get('text'), { cx: W / 2, cy: posY(p), w: 880, s: 1 });
    return out;
  }
  const hasCap = !!(sc.text && sc.text.trim());
  if (hasCap) out.caption = textBox(p, sc.text, get('caption'), { cx: W / 2, cy: 400, w: 880, s: 0.7 });
  const top = hasCap ? 560 : 300;
  const user = get('media');
  if (sc.type === 'code') {
    const m = codeMetrics(sc, user, top);
    out.media = { kind: 'code', ...m.box, m, user: !!user };
  } else if (sc.type === 'terminal') {
    const m = terminalMetrics(sc, user, top);
    out.media = { kind: 'terminal', ...m.box, m, user: !!user };
  } else {
    const [sw, sh] = naturalSize(sc, assets);
    const b = user ? { x: user.x, y: user.y, w: user.w, h: user.h } : defaultMediaBox(sc, top, sw, sh);
    out.media = { kind: sc.type, ...b, sw, sh, frame: sc.frame || 'none', user: !!user };
  }
  return out;
}

/* ---------- entrance / exit shared by media ---------- */
function enterExit(sc, lt) {
  const enter = easeOut(clamp(lt / 0.45));
  let alpha = clamp(lt / 0.25);
  let dy = (1 - enter) * 90;
  if (!sc._last && lt > sc.dur - 0.28) { const q = clamp((sc.dur - lt) / 0.28); alpha *= q; dy -= (1 - q) * 40; }
  return { alpha, dy };
}

/* ---------- code scene ---------- */
const hlCache = new Map();
function getHighlighted(code, lang) {
  const key = lang + '\u0000' + code;
  if (!hlCache.has(key)) {
    if (hlCache.size > 60) hlCache.clear();
    hlCache.set(key, highlight(code, lang));
  }
  return hlCache.get(key);
}

function drawCodeScene(ctx, p, sc, lt, time, mb) {
  const { fs, lh, maxVisible, rawLines } = mb.m;
  const lines = getHighlighted(sc.code || '', sc.lang || 'javascript');
  const totalChars = rawLines.reduce((a, l) => a + l.length + 1, 0);
  const { typeStart, typeDur } = codeTiming(sc);
  const shown = sc.typing ? Math.floor(clamp((lt - typeStart) / typeDur) * totalChars) : totalChars;
  const { x, w } = mb;
  const winH = mb.h;
  const barH = CODE_BAR;
  const { alpha, dy } = enterExit(sc, lt);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(0, dy + mb.y);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.5)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  roundRect(ctx, x, 0, w, winH, 26);
  ctx.fillStyle = ED.bg;
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, x, 0, w, winH, 26);
  ctx.clip();
  ctx.fillStyle = ED.bar;
  ctx.fillRect(x, 0, w, barH);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.beginPath(); ctx.arc(x + 40 + i * 34, barH / 2, 11, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill();
  });
  const fname = sc.filename || 'untitled';
  ctx.font = '600 26px "JetBrains Mono", monospace';
  const tabW = ctx.measureText(fname).width + 70;
  const tabX = x + 150;
  roundRect(ctx, tabX, 16, tabW, barH - 16, [14, 14, 0, 0]);
  ctx.fillStyle = ED.tabBg;
  ctx.fill();
  ctx.fillStyle = ED.colors.type;
  ctx.beginPath(); ctx.arc(tabX + 24, 16 + (barH - 16) / 2, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ED.tabText;
  ctx.textBaseline = 'middle';
  ctx.fillText(fname, tabX + 42, 16 + (barH - 16) / 2 + 1);
  const langName = (LANGS.find((l) => l[0] === sc.lang) || ['', ''])[1];
  if (w > tabX - x + tabW + 200) {
    ctx.font = '400 22px "JetBrains Mono", monospace';
    ctx.fillStyle = ED.gutter;
    ctx.textAlign = 'right';
    ctx.fillText(langName, x + w - 32, barH / 2 + 1);
    ctx.textAlign = 'left';
  }

  let cursorLine = 0, cursorCol = 0, acc = 0;
  for (let i = 0; i < rawLines.length; i++) {
    const len = rawLines[i].length;
    if (shown <= acc + len) { cursorLine = i; cursorCol = shown - acc; break; }
    acc += len + 1;
    cursorLine = i; cursorCol = len;
  }
  const scrollTop = Math.max(0, cursorLine - maxVisible + 1);

  const bodyY = barH + 34;
  ctx.font = `400 ${fs}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textBaseline = 'middle';
  const gutterW = 30 + ctx.measureText(String(lines.length)).width;
  const codeX = x + 34 + gutterW + 28;
  let lineStart = 0;
  for (let i = 0; i < rawLines.length; i++) {
    const ly = bodyY + (i - scrollTop) * lh + lh / 2;
    const visible = i >= scrollTop && i < scrollTop + maxVisible;
    const thisStart = lineStart;
    lineStart += rawLines[i].length + 1;
    if (!visible) continue;
    const isCur = i === cursorLine && (sc.typing ? shown < totalChars || lt < sc.dur : true);
    if (i === cursorLine) {
      ctx.fillStyle = ED.activeLine;
      ctx.fillRect(x, ly - lh / 2, w, lh);
    }
    if (thisStart <= shown) {
      ctx.fillStyle = i === cursorLine ? ED.gutterActive : ED.gutter;
      ctx.textAlign = 'right';
      ctx.fillText(String(i + 1), x + 34 + gutterW, ly);
      ctx.textAlign = 'left';
    }
    let cx = codeX, ci = thisStart;
    for (const tk of lines[i] || []) {
      if (ci >= shown) break;
      const n = Math.min(tk.t.length, shown - ci);
      const part = tk.t.slice(0, n);
      ctx.fillStyle = ED.colors[tk.c] || ED.colors.id;
      if (tk.c === 'com') ctx.font = `italic 400 ${fs}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.fillText(part, cx, ly);
      cx += ctx.measureText(part).width;
      if (tk.c === 'com') ctx.font = `400 ${fs}px "JetBrains Mono", ui-monospace, monospace`;
      ci += tk.t.length;
    }
    if (isCur && i === cursorLine) {
      const before = rawLines[i].slice(0, cursorCol);
      const cxx = codeX + ctx.measureText(before).width;
      const typingNow = sc.typing && shown < totalChars && lt > typeStart;
      if (typingNow || Math.floor(time * 2.2) % 2 === 0) {
        ctx.fillStyle = ED.cursor;
        ctx.fillRect(cxx + 1, ly - fs * 0.62, 4, fs * 1.24);
      }
    }
  }
  ctx.restore();
  roundRect(ctx, x + 0.5, 0.5, w - 1, winH - 1, 26);
  ctx.strokeStyle = ED.border;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

/* ---------- timing shared with the audio engine ---------- */
export function codeTiming(sc) {
  const typeStart = 0.55;
  return { typeStart, typeDur: Math.max(0.6, sc.dur * 0.72 - typeStart) };
}

export function terminalTiming(sc) {
  const cmd = sc.command || '';
  const lines = (sc.output || '').replace(/\t/g, '  ').split('\n');
  const cmdStart = 0.5;
  const cmdDur = sc.typing ? Math.max(0.3, cmd.length / 16) : 0;
  const outStart = cmdStart + cmdDur + (cmd ? 0.35 : 0);
  const room = Math.max(0.2, sc.dur - outStart - 0.8);
  const lineStep = clamp(room / Math.max(1, lines.length), 0.03, 0.14);
  return { cmdStart, cmdDur, outStart, lineStep, lines };
}

/* ---------- terminal scene ---------- */
const TERM = {
  bg: '#0b0e13', bar: '#1a1e26', border: 'rgba(255,255,255,.1)', text: '#d9dee7', dim: '#6b7586',
  prompt: '#4ade80', path: '#60a5fa', str: '#a5e57a', num: '#f7a35c', kw: '#c792ea', err: '#ff6b6b', cursor: '#e6edf3',
};
const OUT_RE = /('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")|(\b-?\d+(?:\.\d+)?\b)|(\b(?:true|false|null|undefined|NaN|Infinity)\b)|([^'"\d]+?(?=['"\d]|\b(?:true|false|null|undefined|NaN|Infinity)\b|$)|.)/g;

function outputTokens(line) {
  if (/^\s*(Uncaught |TypeError|ReferenceError|SyntaxError|RangeError|Error\b|✖|×)/.test(line)) return [{ t: line, c: TERM.err }];
  const out = [];
  let m;
  OUT_RE.lastIndex = 0;
  while ((m = OUT_RE.exec(line))) {
    if (!m[0]) { OUT_RE.lastIndex++; continue; }
    out.push({ t: m[0], c: m[1] ? TERM.str : m[2] ? TERM.num : m[3] ? TERM.kw : TERM.text });
  }
  return out;
}

function drawTerminalScene(ctx, p, sc, lt, time, mb) {
  const { cmdStart, cmdDur, outStart, lineStep } = terminalTiming(sc);
  const { fs, lh, maxVisible, lines, hasOut } = mb.m;
  const cmd = sc.command || '';
  const { x, w } = mb;
  const winH = mb.h;
  const barH = TERM_BAR;
  const { alpha, dy } = enterExit(sc, lt);

  const cmdShown = sc.typing ? Math.floor(clamp((lt - cmdStart) / Math.max(0.01, cmdDur)) * cmd.length) : cmd.length;
  const cmdDone = cmdShown >= cmd.length && lt >= cmdStart + cmdDur;
  const outShown = !hasOut ? 0 : lt < outStart ? 0 : Math.min(lines.length, 1 + Math.floor((lt - outStart) / lineStep));
  const finished = (!hasOut || outShown >= lines.length) && cmdDone && lt >= outStart;
  const rowsNow = 1 + outShown + (finished ? 1 : 0);
  const scrollTop = Math.max(0, rowsNow - maxVisible);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(0, mb.y + dy);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  roundRect(ctx, x, 0, w, winH, 22);
  ctx.fillStyle = TERM.bg;
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, x, 0, w, winH, 22);
  ctx.clip();
  ctx.fillStyle = TERM.bar;
  ctx.fillRect(x, 0, w, barH);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { ctx.beginPath(); ctx.arc(x + 38 + i * 32, barH / 2, 10, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); });
  ctx.font = '600 26px "JetBrains Mono", monospace';
  ctx.fillStyle = TERM.dim;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (w > 420) ctx.fillText(sc.title || 'Terminal', x + w / 2, barH / 2 + 1);
  ctx.textAlign = 'left';

  const font = `400 ${fs}px "JetBrains Mono", ui-monospace, monospace`;
  const bold = `700 ${fs}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.font = font;
  const bx = x + 36;
  const rowY = (r) => barH + 30 + (r - scrollTop) * lh + lh / 2;
  const drawPrompt = (r) => {
    const ly = rowY(r);
    let cx = bx;
    ctx.font = bold; ctx.fillStyle = TERM.prompt; ctx.fillText('➜', cx, ly); cx += ctx.measureText('➜ ').width;
    ctx.fillStyle = TERM.path; ctx.fillText('~/shorts', cx, ly); cx += ctx.measureText('~/shorts ').width;
    ctx.font = font; ctx.fillStyle = TERM.dim; ctx.fillText('$', cx, ly); cx += ctx.measureText('$ ').width;
    return cx;
  };
  const cursor = (cx, r, solid) => {
    if (solid || Math.floor(time * 2.2) % 2 === 0) { ctx.fillStyle = TERM.cursor; ctx.fillRect(cx + 2, rowY(r) - fs * 0.6, fs * 0.55, fs * 1.2); }
  };

  if (0 >= scrollTop) {
    const cx = drawPrompt(0);
    const part = cmd.slice(0, cmdShown);
    ctx.font = font;
    ctx.fillStyle = TERM.text;
    ctx.fillText(part, cx, rowY(0));
    if (!cmdDone || (lt >= cmdStart + cmdDur && lt < outStart && hasOut)) cursor(cx + ctx.measureText(part).width, 0, sc.typing && !cmdDone && lt > cmdStart);
  }
  for (let i = 0; i < outShown; i++) {
    const r = 1 + i;
    if (r < scrollTop) continue;
    let cx = bx;
    for (const tk of outputTokens(lines[i])) { ctx.fillStyle = tk.c; ctx.fillText(tk.t, cx, rowY(r)); cx += ctx.measureText(tk.t).width; }
  }
  if (finished) {
    const r = 1 + outShown;
    const cx = drawPrompt(r);
    cursor(cx, r, false);
  }
  ctx.restore();
  roundRect(ctx, x + 0.5, 0.5, w - 1, winH - 1, 22);
  ctx.strokeStyle = TERM.border;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

/* ---------- image & video scenes ---------- */
/** Fill rect r with the picture (or the cropped part `sr` of it), cutting off what doesn't fit. */
function drawCover(ctx, src, sw, sh, r, zoom = 1, sr = null) {
  const s = Math.max(r.w / sw, r.h / sh) * zoom;
  const dw = sw * s, dh = sh * s;
  if (sr) ctx.drawImage(src, sr.x, sr.y, sr.w, sr.h, r.x + (r.w - dw) / 2, r.y + (r.h - dh) / 2, dw, dh);
  else ctx.drawImage(src, r.x + (r.w - dw) / 2, r.y + (r.h - dh) / 2, dw, dh);
}

function cropRect(sc, src) {
  const c = sc.crop;
  if (!c || !src) return null;
  const fw = src.videoWidth || src.naturalWidth || src.width;
  const fh = src.videoHeight || src.naturalHeight || src.height;
  if (!fw) return null;
  return { x: c.x * fw, y: c.y * fh, w: c.w * fw, h: c.h * fh };
}

/** A neutral "web page" sketch, shown until an image or video is added. */
function drawPlaceholder(ctx, r, kind) {
  const u = Math.min(r.w, r.h * 1.4) / 100;
  if (kind === 'video') {
    ctx.fillStyle = '#141821';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    for (let i = 0; i < 4; i++) { roundRect(ctx, r.x + r.w * 0.08, r.y + r.h * (0.14 + i * 0.12), r.w * (0.84 - i * 0.12), r.h * 0.06, 8); ctx.fill(); }
    const R = Math.max(26, u * 9);
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + r.h * 0.66, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#141821';
    ctx.beginPath(); ctx.moveTo(r.x + r.w / 2 - R * 0.32, r.y + r.h * 0.66 - R * 0.42); ctx.lineTo(r.x + r.w / 2 + R * 0.48, r.y + r.h * 0.66); ctx.lineTo(r.x + r.w / 2 - R * 0.32, r.y + r.h * 0.66 + R * 0.42); ctx.closePath(); ctx.fill();
    return;
  }
  ctx.fillStyle = '#f4f5f8';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const bar = (x, y, w, h, c, rad = 6) => { ctx.fillStyle = c; roundRect(ctx, r.x + x * r.w, r.y + y * r.h, w * r.w, h * r.h, rad); ctx.fill(); };
  bar(0, 0, 1, 0.09, '#ffffff', 0);
  bar(0.06, 0.03, 0.16, 0.03, '#d6dae3');
  bar(0.62, 0.03, 0.1, 0.03, '#e3e6ec'); bar(0.76, 0.03, 0.18, 0.03, '#c7cdd8');
  bar(0.06, 0.17, 0.62, 0.06, '#c9ced8'); bar(0.06, 0.26, 0.44, 0.06, '#c9ced8');
  bar(0.06, 0.36, 0.5, 0.025, '#dde1e8'); bar(0.06, 0.4, 0.42, 0.025, '#dde1e8');
  bar(0.06, 0.48, 0.22, 0.06, '#9aa3b5', 10);
  for (let i = 0; i < 3; i++) {
    bar(0.06 + i * 0.3, 0.62, 0.27, 0.3, '#ffffff', 12);
    bar(0.09 + i * 0.3, 0.65, 0.21, 0.12, '#e6e9ef', 8);
    bar(0.09 + i * 0.3, 0.8, 0.17, 0.025, '#dde1e8');
    bar(0.09 + i * 0.3, 0.84, 0.12, 0.025, '#e6e9ef');
  }
}

function drawFrameChrome(ctx, box, frame, sc) {
  if (frame === 'browser') {
    const b = browserBar(box.w);
    ctx.fillStyle = '#1f232b';
    ctx.fillRect(box.x, box.y, box.w, b);
    const dot = b * 0.13;
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { ctx.beginPath(); ctx.arc(box.x + b * 0.5 + i * dot * 3, box.y + b / 2, dot, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); });
    const ux = box.x + b * 0.5 + dot * 9, uw = box.w - (ux - box.x) - b * 0.5;
    if (uw > 80) {
      ctx.fillStyle = '#2d323c';
      roundRect(ctx, ux, box.y + b * 0.2, uw, b * 0.6, b * 0.3); ctx.fill();
      ctx.font = `500 ${Math.round(b * 0.32)}px "Hanken Grotesk", sans-serif`;
      ctx.fillStyle = '#c9ced6';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      const url = (sc.url || 'yourwebsite.com').replace(/^https?:\/\//, '');
      ctx.fillText('🔒 ' + url, ux + uw / 2, box.y + b / 2 + 1, uw - 30);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }
}

function drawMediaScene(ctx, p, sc, lt, time, mb, src) {
  const frame = mb.frame;
  const fill = mb.x <= 1 && mb.y <= 1 && mb.x + mb.w >= W - 1 && mb.y + mb.h >= H - 1 && frame === 'none';
  const { alpha, dy } = fill ? { alpha: sc._first ? 1 : clamp(lt / 0.3), dy: 0 } : enterExit(sc, lt);
  const zoomOn = sc.zoom ?? sc.type === 'image';
  const z = zoomOn ? 1 + 0.07 * easeOut(clamp(lt / sc.dur)) : 1;
  const r = contentRect(mb, frame);
  const ready = src && (sc.type !== 'video' || src.readyState >= 2);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(0, dy);
  if (frame === 'phone') {
    const R = mb.w * 0.13;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 70; ctx.shadowOffsetY = 28;
    roundRect(ctx, mb.x, mb.y, mb.w, mb.h, R); ctx.fillStyle = '#0b0b0d'; ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#3a3d44'; ctx.lineWidth = Math.max(3, mb.w * 0.006);
    roundRect(ctx, mb.x + 2, mb.y + 2, mb.w - 4, mb.h - 4, R - 2); ctx.stroke();
    ctx.save();
    roundRect(ctx, r.x, r.y, r.w, r.h, Math.max(8, R - (mb.w * 0.04)));
    ctx.clip();
    if (ready) drawCover(ctx, src, mb.sw, mb.sh, r, z, cropRect(sc, src)); else drawPlaceholder(ctx, r, sc.type);
    ctx.restore();
    // dynamic island
    ctx.fillStyle = '#000';
    const iw = mb.w * 0.28, ih = Math.max(10, mb.w * 0.07);
    roundRect(ctx, mb.x + (mb.w - iw) / 2, r.y + ih * 0.5, iw, ih, ih / 2); ctx.fill();
  } else {
    const rad = fill ? 0 : frame === 'browser' ? 20 : 24;
    if (!fill) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
      roundRect(ctx, mb.x, mb.y, mb.w, mb.h, rad); ctx.fillStyle = '#000'; ctx.fill();
      ctx.restore();
    }
    ctx.save();
    roundRect(ctx, mb.x, mb.y, mb.w, mb.h, rad);
    ctx.clip();
    if (ready) drawCover(ctx, src, mb.sw, mb.sh, r, z, cropRect(sc, src));
    else if (src && sc.type === 'video') { ctx.fillStyle = '#141821'; ctx.fillRect(r.x, r.y, r.w, r.h); }
    else drawPlaceholder(ctx, r, sc.type);
    drawFrameChrome(ctx, mb, frame, sc);
    ctx.restore();
  }
  ctx.restore();
}

/* ---------- progress + handle ---------- */
function drawChrome(ctx, p, time, onImage, logo) {
  const L = lookOf(p);
  const dark = !((L.paper || L.light) && !onImage);
  if (p.progress !== false) {
    const n = p.scenes.length;
    const gap = 10, x0 = 60, x1 = W - 60;
    const segW = (x1 - x0 - gap * (n - 1)) / n;
    const { i, lt } = sceneAt(p, time);
    for (let k = 0; k < n; k++) {
      const x = x0 + k * (segW + gap);
      ctx.fillStyle = dark ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.15)';
      roundRect(ctx, x, 92, segW, 8, 4); ctx.fill();
      const f = k < i ? 1 : k > i ? 0 : clamp(lt / p.scenes[k].dur);
      if (f > 0) { ctx.fillStyle = dark ? '#fff' : '#151515'; roundRect(ctx, x, 92, Math.max(8, segW * f), 8, 4); ctx.fill(); }
    }
  }
  const h = (p.handle || '').trim();
  if (!h && !logo) return;
  ctx.font = '600 38px "Hanken Grotesk", sans-serif';
  ctx.textBaseline = 'middle';
  const tw = h ? ctx.measureText(h).width : 0;
  ctx.fillStyle = dark ? 'rgba(0,0,0,.28)' : 'rgba(0,0,0,.06)';
  roundRect(ctx, 60, 128, h ? tw + 104 : 66, 66, 33); ctx.fill();
  if (logo) {
    ctx.save();
    ctx.beginPath(); ctx.arc(93, 161, 24, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#fff'; ctx.fillRect(69, 137, 48, 48);
    drawCover(ctx, logo, logo.width, logo.height, { x: 69, y: 137, w: 48, h: 48 });
    ctx.restore();
  } else {
    ctx.fillStyle = L.brand || (L.hi === '#151515' ? '#ffb020' : L.hi);
    ctx.beginPath(); ctx.arc(93, 161, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#151515';
    ctx.font = '700 24px "Hanken Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText((h.replace('@', '')[0] || '?').toUpperCase(), 93, 162);
    ctx.textAlign = 'left';
  }
  if (h) {
    ctx.font = '600 38px "Hanken Grotesk", sans-serif';
    ctx.fillStyle = dark ? '#fff' : '#151515';
    ctx.fillText(h, 128, 162);
  }
  ctx.textBaseline = 'alphabetic';
}

/* ---------- frame ---------- */
export function renderFrame(ctx, p, time, assets) {
  const bgImg = assets.bgImg || null;
  drawBg(ctx, p, time, bgImg);
  if (!p.scenes.length) return;
  const { i, lt } = sceneAt(p, time);
  const sc = { ...p.scenes[i], _last: i === p.scenes.length - 1, _first: i === 0 };
  const lay = sceneLayout(p, sc, assets);
  let onImage = !!bgImg;
  const mb = lay.media;
  if (mb) {
    if (sc.type === 'code') drawCodeScene(ctx, p, sc, lt, time, mb);
    else if (sc.type === 'terminal') drawTerminalScene(ctx, p, sc, lt, time, mb);
    else {
      const src = sc.type === 'video' ? assets.videos && assets.videos.get(sc.id) : assets.images.get(sc.id);
      drawMediaScene(ctx, p, sc, lt, time, mb, src);
      if (mb.w >= W * 0.9 && mb.h >= H * 0.6) onImage = true; // text sits on top of a big picture
    }
  }
  const tb = lay.text || lay.caption;
  if (tb) {
    drawTextBlock(ctx, p, sc.text, lt, sc.dur, tb.cy, { cx: tb.cx, maxW: tb.w, sizeMul: tb.s, exit: !sc._last, onImage });
  }
  drawChrome(ctx, p, time, onImage, assets.logo);
}
