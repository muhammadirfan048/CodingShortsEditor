// Video loading helpers and the in-app screen recorder.

/* ---------- loading ---------- */
export const loadImage = (blob) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('bad image'));
  img.src = URL.createObjectURL(blob);
});

/** A <video> element for a file, ready to draw its first frame. */
export function loadVideo(blob) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.playsInline = true;
    v.preload = 'auto';
    v.crossOrigin = 'anonymous';
    const fail = () => reject(new Error('This video could not be opened. Try an MP4 or WebM file.'));
    v.onerror = fail;
    v.onloadeddata = () => { v.onerror = null; resolve(v); };
    v.src = URL.createObjectURL(blob);
    v.load();
  });
}

/** Real duration. Browser recordings (WebM) often report Infinity until you seek to the end. */
export function videoDuration(v) {
  if (isFinite(v.duration) && v.duration > 0) return Promise.resolve(v.duration);
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      v.removeEventListener('durationchange', check);
      const d = isFinite(v.duration) ? v.duration : 0;
      v.currentTime = 0;
      resolve(d);
    };
    const check = () => { if (isFinite(v.duration) && v.duration > 0) finish(); };
    v.addEventListener('durationchange', check);
    v.currentTime = 1e101;
    setTimeout(finish, 4000);
  });
}

/** Does this file contain any sound? Checked on smaller files only; larger ones are assumed to. */
export async function hasSound(blob) {
  if (blob.size > 80 * 1024 * 1024) return true;
  try {
    const buf = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(await blob.arrayBuffer());
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i += 97) if (Math.abs(d[i]) > 0.003) return true;
    }
    return false;
  } catch {
    return false; // no audio track, or nothing decodable
  }
}

/* ---------- screen recording ---------- */
export const canRecordScreen = () =>
  typeof navigator !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) && typeof MediaRecorder !== 'undefined';

function pickScreenMime() {
  const list = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return list.find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } }) || '';
}

/**
 * Ask the browser which screen, window or tab to record, then get ready.
 * Returns a session: call start() after any countdown. `done` resolves with
 * { blob, duration, hasAudio } when recording stops, or null if cancelled.
 */
export async function openScreenSession({ mic = true, systemAudio = true } = {}) {
  const display = await navigator.mediaDevices.getDisplayMedia({
    // ask for the screen's full resolution so a cropped area stays sharp
    // (only upper limits: asking for an exact size makes browsers add black bars on other screen shapes)
    video: { frameRate: { ideal: 30, max: 60 }, width: { max: 3840 }, height: { max: 2160 } },
    audio: systemAudio,
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'include',
    systemAudio: systemAudio ? 'include' : 'exclude',
  });
  let micStream = null;
  let micDenied = false;
  if (mic) {
    try { micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { micDenied = true; }
  }

  // mix the screen's sound and the microphone into one track
  const sources = [display, micStream].filter((s) => s && s.getAudioTracks().length);
  const tracks = [...display.getVideoTracks()];
  let mixCtx = null;
  if (sources.length === 1) tracks.push(sources[0].getAudioTracks()[0]);
  else if (sources.length > 1) {
    mixCtx = new AudioContext();
    const dest = mixCtx.createMediaStreamDestination();
    sources.forEach((s) => mixCtx.createMediaStreamSource(s).connect(dest));
    tracks.push(dest.stream.getAudioTracks()[0]);
  }
  const hasAudio = sources.length > 0;
  const mimeType = pickScreenMime();
  const rec = new MediaRecorder(new MediaStream(tracks), { mimeType, videoBitsPerSecond: 12_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

  let cancelled = false;
  let activeMs = 0;
  let resumedAt = 0;
  const stopTracks = () => {
    display.getTracks().forEach((t) => t.stop());
    micStream && micStream.getTracks().forEach((t) => t.stop());
    mixCtx && mixCtx.close().catch(() => {});
  };
  let resolveDone = () => {};
  const done = new Promise((resolve) => {
    resolveDone = resolve;
    rec.onstop = () => {
      stopTracks();
      if (resumedAt) activeMs += performance.now() - resumedAt;
      if (cancelled || !chunks.length) { resolve(null); return; }
      const type = (mimeType || 'video/webm').split(';')[0];
      resolve({ blob: new Blob(chunks, { type }), duration: activeMs / 1000, hasAudio });
    };
  });
  // the browser's own "Stop sharing" button ends the track
  display.getVideoTracks()[0].addEventListener('ended', () => {
    if (rec.state !== 'inactive') rec.stop();
    else { stopTracks(); resolveDone(null); } // sharing stopped before recording began
  });

  const settings = display.getVideoTracks()[0].getSettings ? display.getVideoTracks()[0].getSettings() : {};
  return {
    stream: display, // live picture of what is shared, for previews
    size: [settings.width || 1920, settings.height || 1080],
    micDenied,
    hasAudio,
    surface: settings.displaySurface || '',
    done,
    elapsed: () => (activeMs + (resumedAt ? performance.now() - resumedAt : 0)) / 1000,
    get paused() { return rec.state === 'paused'; },
    start() { rec.start(500); resumedAt = performance.now(); },
    pause() { if (rec.state === 'recording') { rec.pause(); activeMs += performance.now() - resumedAt; resumedAt = 0; } },
    resume() { if (rec.state === 'paused') { rec.resume(); resumedAt = performance.now(); } },
    stop() { if (rec.state !== 'inactive') rec.stop(); else { stopTracks(); resolveDone(null); } },
    cancel() { cancelled = true; if (rec.state !== 'inactive') rec.stop(); else { stopTracks(); resolveDone(null); } },
  };
}
