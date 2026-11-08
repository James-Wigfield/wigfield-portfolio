/* A very small IndexedDB layer for Memory Rooms (database `memory-rooms`).

   Stores
     outbox       keyPath id   one row per saved capture (small: spot fields + per-file flags)
     outboxFiles  keyPath key  `${spotId}|${type}|${n}` → { blob, width, height, contentType } (immutable)
     draft        keyPath key  'current' → the capture being filled in (fields + photo order)
     draftPhotos  keyPath id   one processed photo (photo + thumb blobs) or the 'scan' file

   If IndexedDB can't open at all (some private modes), everything falls back to
   in-memory maps so the app still works while the tab stays open. */

const NAME = 'memory-rooms';
const VERSION = 1;
const STORES = { outbox: 'id', outboxFiles: 'key', draft: 'key', draftPhotos: 'id' };

let dbPromise = null;
const memory = new Map(Object.keys(STORES).map((s) => [s, new Map()]));

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      let r;
      try {
        r = window.indexedDB.open(NAME, VERSION);
      } catch {
        resolve(null);
        return;
      }
      r.onupgradeneeded = () => {
        const db = r.result;
        for (const [name, keyPath] of Object.entries(STORES)) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
        }
      };
      r.onsuccess = () => {
        const db = r.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      r.onerror = () => resolve(null);
    });
  }
  return dbPromise;
}

const done = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/* Files are stored as plain ArrayBuffers, never as Blobs. WebKit refuses Blobs in
   IndexedDB in some modes ("DataCloneError: BlobURLs are not yet supported", e.g.
   Safari private browsing), and re-storing database-backed Blobs is fragile there.
   ArrayBuffers work in every browser and mode. Top-level Blob fields are packed
   before a write and unpacked on every read, so callers only ever see Blobs.
   (Rows written by older builds that hold real Blobs still read fine.) */
const PACKED = '__mrBlob';

async function pack(value) {
  if (!value || typeof value !== 'object') return value;
  let out = value;
  for (const [k, v] of Object.entries(value)) {
    if (typeof Blob !== 'undefined' && v instanceof Blob) {
      if (out === value) out = { ...value };
      out[k] = { [PACKED]: true, type: v.type, buffer: await v.arrayBuffer() };
    }
  }
  return out;
}

function unpack(value) {
  if (!value || typeof value !== 'object') return value;
  let out = value;
  for (const [k, v] of Object.entries(value)) {
    if (v && typeof v === 'object' && v[PACKED]) {
      if (out === value) out = { ...value };
      out[k] = new Blob([v.buffer], { type: v.type });
    }
  }
  return out;
}

/** True when we're on the in-memory fallback (nothing survives a reload). */
export async function isVolatile() {
  return !(await open());
}

export async function getAll(store) {
  const db = await open();
  if (!db) return Array.from(memory.get(store).values());
  return (await done(db.transaction(store).objectStore(store).getAll())).map(unpack);
}

export async function get(store, key) {
  const db = await open();
  if (!db) return memory.get(store).get(key) ?? null;
  return unpack((await done(db.transaction(store).objectStore(store).get(key))) ?? null);
}

/** Every row whose key starts with `prefix` (string keys). */
export async function getByPrefix(store, prefix) {
  const db = await open();
  if (!db) return Array.from(memory.get(store).entries()).filter(([k]) => String(k).startsWith(prefix)).map(([, v]) => v);
  return (await done(db.transaction(store).objectStore(store).getAll(IDBKeyRange.bound(prefix, `${prefix}￿`)))).map(unpack);
}

/**
 * One atomic write across several stores. `fn(w)` issues writes synchronously:
 * w.put(store, value), w.del(store, key), w.delPrefix(store, prefix), w.clear(store).
 * Resolves when the transaction commits (the data is on disk).
 */
export async function write(storeNames, fn) {
  const names = [].concat(storeNames);
  const db = await open();
  if (!db) {
    fn({
      put: (s, v) => memory.get(s).set(v[STORES[s]], v),
      del: (s, k) => memory.get(s).delete(k),
      delPrefix: (s, p) => {
        for (const k of memory.get(s).keys()) if (String(k).startsWith(p)) memory.get(s).delete(k);
      },
      clear: (s) => memory.get(s).clear(),
    });
    return;
  }
  // Record the operations first, so Blobs can be packed (async) BEFORE the
  // transaction opens: an IndexedDB transaction commits as soon as the code
  // awaits anything, so nothing async may happen inside it.
  const ops = [];
  fn({
    put: (s, v) => ops.push(['put', s, v]),
    del: (s, k) => ops.push(['del', s, k]),
    delPrefix: (s, p) => ops.push(['delPrefix', s, p]),
    clear: (s) => ops.push(['clear', s]),
  });
  for (const op of ops) if (op[0] === 'put') op[2] = await pack(op[2]);

  await new Promise((resolve, reject) => {
    let t;
    try {
      t = db.transaction(names, 'readwrite');
      for (const [kind, s, arg] of ops) {
        const os = t.objectStore(s);
        if (kind === 'put') os.put(arg);
        else if (kind === 'del') os.delete(arg);
        else if (kind === 'delPrefix') os.delete(IDBKeyRange.bound(arg, `${arg}￿`));
        else os.clear();
      }
    } catch (err) {
      try {
        t?.abort();
      } catch {
        /* already finished */
      }
      reject(err);
      return;
    }
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('IndexedDB transaction aborted'));
  });
}

export const put = (store, value) => write(store, (w) => w.put(store, value));
export const del = (store, key) => write(store, (w) => w.del(store, key));
