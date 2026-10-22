// Keeps uploaded files (images, music, sounds) in the browser's IndexedDB,
// so they are still there after a page reload. Nothing leaves your computer.

const DB = 'shortsmith-files';
const STORE = 'files';
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('no indexedDB')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function run(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = () => reject(tx.error);
  }));
}

/** Save a file under a key, e.g. "music", "img:<sceneId>". */
export const saveFile = (key, file) =>
  run('readwrite', (s) => s.put({ blob: file, name: file.name || key, type: file.type || '' }, key)).catch(() => {});

export const deleteFile = (key) => run('readwrite', (s) => s.delete(key)).catch(() => {});

/** All saved files as [{ key, blob, name }]. */
export async function loadAllFiles() {
  try {
    const keys = await run('readonly', (s) => s.getAllKeys());
    const vals = await run('readonly', (s) => s.getAll());
    return (keys || []).map((key, i) => ({ key, ...vals[i] }));
  } catch {
    return [];
  }
}
