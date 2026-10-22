import React, { useEffect, useRef } from 'react';

export default function ResultModal({ result, length, fileName, onClose }) {
  const saveRef = useRef(null);
  useEffect(() => {
    saveRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="doneH" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <video src={result.url} controls playsInline autoPlay />
        <div>
          <h3 id="doneH">Your video is ready</h3>
          <p>Play it back, then save it and upload it to YouTube Shorts, Instagram Reels or TikTok. All three take 9:16 video like this one.</p>
          <dl className="meta">
            <dt>Size</dt><dd>1080 × 1920 (9:16)</dd>
            <dt>Length</dt><dd>{length} · 30 fps</dd>
            <dt>Format</dt><dd>{result.ext.toUpperCase()}{result.ext === 'webm' ? ' (YouTube accepts it)' : ''}</dd>
            <dt>File</dt><dd>{(result.blob.size / 1048576).toFixed(1)} MB</dd>
          </dl>
          <div className="actions">
            <a ref={saveRef} className="btn primary" href={result.url} download={fileName}>Save video</a>
            <button className="btn" type="button" onClick={onClose}>Back to editor</button>
          </div>
        </div>
      </div>
    </div>
  );
}
